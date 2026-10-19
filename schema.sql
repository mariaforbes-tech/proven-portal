-- =====================================================================
-- PROVEN PORTAL — esquema de base de datos (Supabase / Postgres)
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================

set check_function_bodies = off;   -- permite definir funciones antes de las tablas que usan

create extension if not exists pgcrypto;

-- ---------- PERFILES (una fila por persona que se registra) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  phone       text not null default '',
  lang        text not null default 'es',
  grp         text not null default 'gigs' check (grp in ('crew','gigs')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected','disabled')),
  is_admin    boolean not null default false,   -- Juliana: control total
  is_office   boolean not null default false,   -- Doris: maneja proyectos, turnos, documentos y horas
  is_finance  boolean not null default false,   -- Ana: ve los números, no aprueba gente ni cambia proyectos
  perms       jsonb not null default '{"projects":false,"clock":false,"shifts":false,"docs":false,"pay":false}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Permisos que se copian a cada persona nueva cuando la apruebas
create table if not exists public.group_defaults (
  grp    text primary key check (grp in ('crew','gigs')),
  perms  jsonb not null
);
insert into public.group_defaults (grp, perms) values
  ('crew', '{"projects":true,"clock":true,"shifts":false,"docs":true,"pay":true}'),
  ('gigs', '{"projects":true,"clock":true,"shifts":true,"docs":true,"pay":true}')
on conflict (grp) do nothing;

-- ---------- FUNCIONES DE SEGURIDAD ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p
                   where p.id = auth.uid() and p.status = 'approved'), false)
$$;

-- "staff" = quien MANEJA la operación: administradora (Juliana) u oficina (Doris)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (p.is_admin or p.is_office) from public.profiles p
                   where p.id = auth.uid() and p.status = 'approved'), false)
$$;

-- "finanzas" = Ana: ve los números
create or replace function public.is_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (p.is_admin or p.is_finance) from public.profiles p
                   where p.id = auth.uid() and p.status = 'approved'), false)
$$;

-- "viewer" = quien puede VER todo (Juliana, Doris, Ana)
create or replace function public.is_viewer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (p.is_admin or p.is_office or p.is_finance) from public.profiles p
                   where p.id = auth.uid() and p.status = 'approved'), false)
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (pr.perms ->> p)::boolean from public.profiles pr
                   where pr.id = auth.uid() and pr.status = 'approved'), false)
$$;

create or replace function public.is_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members m
                 join public.profiles p on p.id = m.worker_id
                 where m.project_id = pid and m.worker_id = auth.uid() and p.status = 'approved')
$$;

create or replace function public.is_foreman(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members m
                 join public.profiles p on p.id = m.worker_id
                 where m.project_id = pid and m.worker_id = auth.uid()
                   and m.role = 'foreman' and p.status = 'approved')
$$;

-- ---------- AL REGISTRARSE: crear perfil en "pending" ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, lang, grp)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when new.raw_user_meta_data ->> 'lang' = 'en' then 'en' else 'es' end,
    case when new.raw_user_meta_data ->> 'grp' = 'crew' then 'crew' else 'gigs' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un trabajador NO puede cambiarse su propio estado, permisos, grupo ni roles
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status     := old.status;
    new.is_admin   := old.is_admin;
    new.is_office  := old.is_office;
    new.is_finance := old.is_finance;
    new.perms      := old.perms;
    new.grp        := old.grp;
    new.email      := old.email;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- PROYECTOS ----------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  client     text not null default '',
  address    text not null default '',
  status     text not null default 'active' check (status in ('active','paused','done')),
  starts_on  date,
  ends_on    date,
  contract   numeric(12,2),            -- lo que paga el cliente; con esto se calcula si vamos ganando
  pct_manual int check (pct_manual between 0 and 100),  -- avance a mano, para obras sin scope cargado
  notes      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.projects add column if not exists ends_on date;
alter table public.projects add column if not exists contract numeric(12,2);
alter table public.projects add column if not exists pct_manual int;
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id  uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('member','foreman')),
  primary key (project_id, worker_id)
);

-- Nombres de la gente del proyecto (sin exponer teléfonos ni correos)
create or replace function public.project_people(p_project uuid)
returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, m.role
  from public.project_members m join public.profiles p on p.id = m.worker_id
  where m.project_id = p_project and (public.is_staff() or public.is_member(p_project))
$$;

-- ---------- SCOPE: lo que hay que hacer, en orden ----------
create table if not exists public.scope_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title      text not null,
  trade      text not null default '',          -- demolición, plomería, sheetrock, pintura…
  kind       text not null default 'phase' check (kind in ('phase','todo')),  -- fase de obra, o pendiente suelto del día
  cadence    text not null default 'once' check (cadence in ('once','daily','weekly')),
  starts_on  date,
  due_on     date,
  status     text not null default 'pending' check (status in ('pending','active','done','blocked')),
  done_on    date,
  weight     numeric(6,2) not null default 1 check (weight > 0),
  notes      text not null default '',
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists scope_project_idx on public.scope_items (project_id, sort);
alter table public.scope_items add column if not exists kind text not null default 'phase';

-- Marcas del checklist diario y semanal (una por periodo, para que se reinicie solo)
create table if not exists public.scope_checks (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.scope_items(id) on delete cascade,
  period     text not null,                      -- '2026-10-15' para diario, '2026-W42' para semanal
  done_by    uuid references public.profiles(id) on delete set null,
  done_at    timestamptz not null default now(),
  unique (item_id, period)
);

-- ---------- MATERIALES ----------
create table if not exists public.materials (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id    uuid references public.scope_items(id) on delete set null,
  title      text not null,
  qty        text not null default '',
  vendor     text not null default '',
  needed_by  date,
  est_cost   numeric(10,2),
  bought     boolean not null default false,
  bought_on  date,
  bought_by  uuid references public.profiles(id) on delete set null,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists materials_project_idx on public.materials (project_id, bought);

-- ---------- SELECCIONES DEL CLIENTE ----------
-- Lo que el cliente tiene que escoger: acabados, con su fecha límite y su allowance.
-- La fecha manda: si no escoge a tiempo, el material no llega y el cronograma se corre.
-- allowance = lo presupuestado. actual_cost = lo que costó lo que escogió. La resta es lo que sangra.
create table if not exists public.selections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  room        text not null default '',
  allowance   numeric(10,2),
  actual_cost numeric(10,2),
  choice      text not null default '',
  due_on      date,
  install_on  date,
  status      text not null default 'pending' check (status in ('pending','chosen','ordered')),
  decided_on  date,
  decided_by  uuid references public.profiles(id) on delete set null,
  notes       text not null default '',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists selections_project_idx on public.selections (project_id, status, due_on);

-- ---------- CHAT / RECIBOS DEL PROYECTO ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'text' check (kind in ('text','photo','receipt')),
  body       text not null default '',
  amount     numeric(10,2),
  vendor     text not null default '',
  file_path  text,
  file_name  text,
  created_at timestamptz not null default now()
);
create index if not exists messages_project_idx on public.messages (project_id, created_at);

-- ---------- RELOJ (entrada / descansos / salida) ----------
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists one_open_entry_per_worker
  on public.time_entries (worker_id) where clock_out is null;
create index if not exists time_entries_idx on public.time_entries (clock_in);

create table if not exists public.time_breaks (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.time_entries(id) on delete cascade,
  start_at   timestamptz not null default now(),
  end_at     timestamptz
);

create or replace function public.can_see_entry(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.time_entries e
                 where e.id = eid
                   and ((e.worker_id = auth.uid() and public.has_perm('clock'))
                        or public.is_viewer()
                        or public.is_foreman(e.project_id)))
$$;

-- El reloj usa la hora del SERVIDOR (nadie puede inventar horas desde el celular)
create or replace function public.clock_in(p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.has_perm('clock') then raise exception 'no_access'; end if;
  if not public.is_member(p_project) then raise exception 'not_member'; end if;
  if exists (select 1 from public.time_entries where worker_id = auth.uid() and clock_out is null) then
    raise exception 'already_clocked_in';
  end if;
  insert into public.time_entries (worker_id, project_id) values (auth.uid(), p_project)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.start_break() returns void
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  select id into eid from public.time_entries where worker_id = auth.uid() and clock_out is null;
  if eid is null then raise exception 'not_clocked_in'; end if;
  if exists (select 1 from public.time_breaks where entry_id = eid and end_at is null) then return; end if;
  insert into public.time_breaks (entry_id) values (eid);
end $$;

create or replace function public.end_break() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.time_breaks set end_at = now()
   where end_at is null
     and entry_id in (select id from public.time_entries where worker_id = auth.uid() and clock_out is null);
end $$;

create or replace function public.clock_out() returns void
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  select id into eid from public.time_entries where worker_id = auth.uid() and clock_out is null;
  if eid is null then return; end if;
  update public.time_breaks set end_at = now() where entry_id = eid and end_at is null;
  update public.time_entries set clock_out = now() where id = eid;
end $$;

-- ---------- TURNOS GIGS ----------
create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  address    text not null default '',
  starts_at  timestamptz,
  hours      numeric(5,2),
  rate       text not null default '',
  spots      int not null default 1 check (spots > 0),
  notes      text not null default '',
  status     text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.shift_claims (
  shift_id   uuid not null references public.shifts(id) on delete cascade,
  worker_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, worker_id)
);

create or replace function public.list_shifts()
returns table (id uuid, title text, address text, starts_at timestamptz, hours numeric,
               rate text, spots int, notes text, status text, taken int, mine boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, s.address, s.starts_at, s.hours, s.rate, s.spots, s.notes, s.status,
         (select count(*)::int from public.shift_claims c where c.shift_id = s.id),
         exists (select 1 from public.shift_claims c where c.shift_id = s.id and c.worker_id = auth.uid())
  from public.shifts s
  where public.has_perm('shifts') or public.is_staff()
  order by s.starts_at nulls last
$$;

create or replace function public.claim_shift(p_shift uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.shifts; n int;
begin
  if not public.has_perm('shifts') then raise exception 'no_access'; end if;
  select * into s from public.shifts where id = p_shift for update;
  if not found then raise exception 'not_found'; end if;
  if s.status <> 'open' then raise exception 'closed'; end if;
  select count(*) into n from public.shift_claims where shift_id = p_shift;
  if n >= s.spots then raise exception 'full'; end if;
  insert into public.shift_claims (shift_id, worker_id) values (p_shift, auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.release_shift(p_shift uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.shift_claims where shift_id = p_shift and worker_id = auth.uid()
$$;

-- ---------- DOCUMENTOS ----------
create table if not exists public.doc_requirements (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  kind      text not null default 'upload' check (kind in ('upload','sign')),
  body      text not null default '',
  for_grp   text not null default 'all' check (for_grp in ('all','crew','gigs')),
  required  boolean not null default true,
  sort      int not null default 0
);
create table if not exists public.worker_documents (
  id             uuid primary key default gen_random_uuid(),
  worker_id      uuid not null references public.profiles(id) on delete cascade,
  requirement_id uuid not null references public.doc_requirements(id) on delete cascade,
  file_path      text,
  file_name      text,
  signed_name    text,
  signed_at      timestamptz,
  status         text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  note           text not null default '',
  created_at     timestamptz not null default now(),
  unique (worker_id, requirement_id)
);

-- ---------- PAGOS ----------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.profiles(id) on delete cascade,
  amount     numeric(10,2) not null check (amount >= 0),
  paid_on    date not null default current_date,
  method     text not null default '',
  memo       text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- GASTOS / FACTURAS (manuales o importados del banco) ----------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  spent_on   date not null default current_date,
  amount     numeric(12,2) not null,
  vendor     text not null default '',
  memo       text not null default '',
  category   text not null default 'materials',
  project_id uuid references public.projects(id) on delete set null,
  source     text not null default 'manual' check (source in ('manual','import','receipt')),
  ext_id     text,                       -- id/huella de la línea del banco: evita duplicados al reimportar
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists expenses_ext_uniq on public.expenses (ext_id) where ext_id is not null;
create index if not exists expenses_date_idx on public.expenses (spent_on);

-- ---------- GASTOS FIJOS (lo que se paga pase lo que pase, sin proyecto) ----------
create table if not exists public.fixed_costs (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  vendor     text not null default '',
  amount     numeric(10,2) not null check (amount >= 0),
  cadence    text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','yearly')),
  due_day    int check (due_day between 1 and 31),
  category   text not null default 'office',
  owner      text not null default '',          -- quién lo paga: Juliana, Ana…
  active     boolean not null default true,
  notes      text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- CHECKLIST DE PUBLICACIONES (solo Juliana) ----------
create table if not exists public.content_posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  platform   text not null default 'instagram',
  format     text not null default 'reel' check (format in ('reel','carousel','photo','story','blog','email')),
  due_on     date,
  status     text not null default 'idea' check (status in ('idea','filming','editing','scheduled','posted')),
  posted_on  date,
  link       text not null default '',
  notes      text not null default '',
  views      int,
  saves      int,
  leads      int,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- METAS POR RED (cuántas publicaciones por semana) ----------
create table if not exists public.net_targets (
  network text primary key,
  weekly  int not null default 0 check (weekly >= 0)
);
insert into public.net_targets (network, weekly) values
  ('instagram',4), ('facebook',4), ('facebook_groups',7), ('tiktok',4),
  ('blog',2), ('linkedin',2), ('youtube',4), ('yelp',2)
on conflict (network) do nothing;

-- ---------- EMBUDO (solo Juliana) ----------
create table if not exists public.funnel_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null default '',
  source     text not null default 'instagram',
  borough    text not null default '',
  scope      text not null default '',
  value      numeric(12,2),
  stage      text not null default 'new' check (stage in ('new','contacted','visit','quoted','won','lost')),
  next_step  text not null default '',
  next_on    date,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funnel_stage_idx on public.funnel_leads (stage);

create or replace function public.touch_updated() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists funnel_touch on public.funnel_leads;
create trigger funnel_touch before update on public.funnel_leads
  for each row execute function public.touch_updated();

-- ---------- SEGURIDAD A NIVEL DE FILA (RLS) ----------
alter table public.profiles          enable row level security;
alter table public.group_defaults    enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.messages          enable row level security;
alter table public.time_entries      enable row level security;
alter table public.time_breaks       enable row level security;
alter table public.shifts            enable row level security;
alter table public.shift_claims      enable row level security;
alter table public.doc_requirements  enable row level security;
alter table public.worker_documents  enable row level security;
alter table public.payments          enable row level security;
alter table public.scope_items       enable row level security;
alter table public.scope_checks      enable row level security;
alter table public.materials         enable row level security;
alter table public.selections        enable row level security;
alter table public.expenses          enable row level security;
alter table public.fixed_costs       enable row level security;
alter table public.content_posts     enable row level security;
alter table public.funnel_leads      enable row level security;
alter table public.net_targets       enable row level security;

-- profiles: cada quien ve el suyo; oficina y finanzas ven todos; solo admin cambia estado/permisos
drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select using (id = auth.uid() or public.is_viewer());
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update using (id = auth.uid() or public.is_admin())
                                           with check (id = auth.uid() or public.is_admin());
drop policy if exists p_del on public.profiles;
create policy p_del on public.profiles for delete using (public.is_admin());

drop policy if exists gd_all on public.group_defaults;
create policy gd_all on public.group_defaults for all using (public.is_admin()) with check (public.is_admin());

-- proyectos: staff ve y edita todo; el trabajador ve solo donde es miembro
drop policy if exists pr_staff on public.projects;
create policy pr_staff on public.projects for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists pr_sel on public.projects;
create policy pr_sel on public.projects for select using (
  public.is_viewer() or (public.has_perm('projects') and public.is_member(id)));

drop policy if exists pm_staff on public.project_members;
create policy pm_staff on public.project_members for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists pm_sel on public.project_members;
create policy pm_sel on public.project_members for select using (worker_id = auth.uid());

-- scope: lo ve quien está en la obra; lo arma la oficina; el foreman mueve el estado de una tarea
drop policy if exists si_staff on public.scope_items;
create policy si_staff on public.scope_items for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists si_sel on public.scope_items;
create policy si_sel on public.scope_items for select using (
  public.is_viewer() or (public.has_perm('projects') and public.is_member(project_id)));
drop policy if exists si_upd on public.scope_items;
create policy si_upd on public.scope_items for update using (public.is_foreman(project_id)) with check (public.is_foreman(project_id));

-- marcas del checklist: cualquiera de la obra marca la suya; nadie marca por otro
drop policy if exists sc_staff2 on public.scope_checks;
create policy sc_staff2 on public.scope_checks for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists sc_sel2 on public.scope_checks;
create policy sc_sel2 on public.scope_checks for select using (
  public.is_viewer() or exists (select 1 from public.scope_items i
    where i.id = item_id and public.has_perm('projects') and public.is_member(i.project_id)));
drop policy if exists sc_ins2 on public.scope_checks;
create policy sc_ins2 on public.scope_checks for insert with check (
  done_by = auth.uid() and exists (select 1 from public.scope_items i
    where i.id = item_id and public.has_perm('projects') and public.is_member(i.project_id)));
drop policy if exists sc_del2 on public.scope_checks;
create policy sc_del2 on public.scope_checks for delete using (
  done_by = auth.uid() or public.is_staff());

-- materiales: el de la obra los pide y los marca comprados; la oficina los edita y borra
drop policy if exists mt_staff on public.materials;
create policy mt_staff on public.materials for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists mt_sel on public.materials;
create policy mt_sel on public.materials for select using (
  public.is_viewer() or (public.has_perm('projects') and public.is_member(project_id)));
drop policy if exists mt_ins on public.materials;
create policy mt_ins on public.materials for insert with check (
  added_by = auth.uid() and public.has_perm('projects') and public.is_member(project_id));
drop policy if exists mt_upd on public.materials;
create policy mt_upd on public.materials for update using (
  public.has_perm('projects') and public.is_member(project_id)) with check (
  public.has_perm('projects') and public.is_member(project_id));

-- selecciones: las decide la oficina (es plata del cliente). La obra solo las ve,
-- porque lo que no se escoge le bloquea la instalación.
drop policy if exists sl_staff on public.selections;
create policy sl_staff on public.selections for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists sl_sel on public.selections;
create policy sl_sel on public.selections for select using (
  public.is_viewer() or (public.has_perm('projects') and public.is_member(project_id)));

-- chat y recibos: miembros del proyecto + staff. Nadie edita lo ya enviado.
drop policy if exists m_sel on public.messages;
create policy m_sel on public.messages for select using (
  public.is_viewer() or (public.has_perm('projects') and public.is_member(project_id)));
drop policy if exists m_ins on public.messages;
create policy m_ins on public.messages for insert with check (
  author_id = auth.uid() and
  (public.is_staff() or (public.has_perm('projects') and public.is_member(project_id))));
drop policy if exists m_del on public.messages;
create policy m_del on public.messages for delete using (public.is_admin());

-- reloj: lectura según rol; escritura directa solo staff (correcciones). El trabajador usa las funciones.
drop policy if exists te_sel on public.time_entries;
create policy te_sel on public.time_entries for select using (public.can_see_entry(id));
drop policy if exists te_staff on public.time_entries;
create policy te_staff on public.time_entries for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists tb_sel on public.time_breaks;
create policy tb_sel on public.time_breaks for select using (public.can_see_entry(entry_id));
drop policy if exists tb_staff on public.time_breaks;
create policy tb_staff on public.time_breaks for all using (public.is_staff()) with check (public.is_staff());

-- turnos
drop policy if exists s_staff on public.shifts;
create policy s_staff on public.shifts for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists sc_staff on public.shift_claims;
create policy sc_staff on public.shift_claims for all using (public.is_staff()) with check (public.is_staff());

-- documentos
drop policy if exists dr_staff on public.doc_requirements;
create policy dr_staff on public.doc_requirements for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists dr_sel on public.doc_requirements;
create policy dr_sel on public.doc_requirements for select using (public.has_perm('docs'));

drop policy if exists wd_staff on public.worker_documents;
create policy wd_staff on public.worker_documents for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists wd_sel on public.worker_documents;
create policy wd_sel on public.worker_documents for select using (worker_id = auth.uid() and public.has_perm('docs'));
drop policy if exists wd_ins on public.worker_documents;
create policy wd_ins on public.worker_documents for insert
  with check (worker_id = auth.uid() and public.has_perm('docs') and status = 'submitted');
drop policy if exists wd_upd on public.worker_documents;
create policy wd_upd on public.worker_documents for update
  using (worker_id = auth.uid() and public.has_perm('docs') and status <> 'approved')
  with check (worker_id = auth.uid() and status = 'submitted');

-- pagos: solo administradora escribe; oficina y finanzas leen; cada trabajador ve los suyos
drop policy if exists pay_admin on public.payments;
create policy pay_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists pay_sel on public.payments;
create policy pay_sel on public.payments for select using (
  public.is_viewer() or (worker_id = auth.uid() and public.has_perm('pay')));

-- gastos: los ve quien ve los números; los escribe admin o finanzas
drop policy if exists exp_sel on public.expenses;
create policy exp_sel on public.expenses for select using (public.is_viewer());
drop policy if exists exp_ins on public.expenses;
create policy exp_ins on public.expenses for insert with check (public.is_finance());
drop policy if exists exp_upd on public.expenses;
create policy exp_upd on public.expenses for update using (public.is_finance()) with check (public.is_finance());
drop policy if exists exp_del on public.expenses;
create policy exp_del on public.expenses for delete using (public.is_finance());

-- gastos fijos: los ve quien ve los números; los maneja admin o finanzas
drop policy if exists fx_sel on public.fixed_costs;
create policy fx_sel on public.fixed_costs for select using (public.is_viewer());
drop policy if exists fx_all on public.fixed_costs;
create policy fx_all on public.fixed_costs for all using (public.is_finance()) with check (public.is_finance());

-- marketing y embudo: solo la administradora
drop policy if exists cp_admin on public.content_posts;
create policy cp_admin on public.content_posts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists fl_admin on public.funnel_leads;
create policy fl_admin on public.funnel_leads for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists nt_admin on public.net_targets;
create policy nt_admin on public.net_targets for all using (public.is_admin()) with check (public.is_admin());

-- ---------- ARCHIVOS (dos buckets privados) ----------
insert into storage.buckets (id, name, public) values ('worker-docs', 'worker-docs', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false)
on conflict (id) do nothing;

-- worker-docs: carpeta = id del trabajador
drop policy if exists wdoc_sel on storage.objects;
create policy wdoc_sel on storage.objects for select using (
  bucket_id = 'worker-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists wdoc_ins on storage.objects;
create policy wdoc_ins on storage.objects for insert with check (
  bucket_id = 'worker-docs' and (storage.foldername(name))[1] = auth.uid()::text and public.has_perm('docs'));
drop policy if exists wdoc_upd on storage.objects;
create policy wdoc_upd on storage.objects for update using (
  bucket_id = 'worker-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists wdoc_del on storage.objects;
create policy wdoc_del on storage.objects for delete using (
  bucket_id = 'worker-docs' and public.is_admin());

-- project-files: carpeta = id del proyecto (fotos y recibos del chat)
drop policy if exists pf_sel on storage.objects;
create policy pf_sel on storage.objects for select using (
  bucket_id = 'project-files' and
  (public.is_viewer() or (public.has_perm('projects') and public.is_member(((storage.foldername(name))[1])::uuid))));
drop policy if exists pf_ins on storage.objects;
create policy pf_ins on storage.objects for insert with check (
  bucket_id = 'project-files' and
  (public.is_staff() or (public.has_perm('projects') and public.is_member(((storage.foldername(name))[1])::uuid))));
drop policy if exists pf_del on storage.objects;
create policy pf_del on storage.objects for delete using (
  bucket_id = 'project-files' and public.is_admin());

-- ---------- DOCUMENTOS INICIALES (se editan desde el portal) ----------
insert into public.doc_requirements (title, kind, body, for_grp, required, sort)
select * from (values
  ('W-9',                                'upload', '', 'gigs', true, 1),
  ('Foto de identificación / Photo ID',  'upload', '', 'all',  true, 2),
  ('Acuerdo de contratista independiente / Independent Contractor Agreement', 'sign',
   '[REEMPLAZA ESTE TEXTO por el acuerdo que revise tu abogado. Se edita desde el portal: Documentos → Documentos requeridos.]',
   'gigs', true, 3)
) as v(title, kind, body, for_grp, required, sort)
where not exists (select 1 from public.doc_requirements);

-- =====================================================================
-- PASO FINAL (después de registrarte tú misma en el portal):
-- cambia el correo y corre SOLO esto para convertirte en administradora.
-- =====================================================================
-- update public.profiles
--    set is_admin = true, status = 'approved',
--        perms = '{"projects":true,"clock":true,"shifts":true,"docs":true,"pay":true}'
--  where email = 'TU_CORREO@ejemplo.com';
--
-- A Doris y a Ana las activas desde el portal (Centro de mando), no desde aquí.
