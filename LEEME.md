# Portal del equipo — Proven Solutions

Portal interno para la cuadrilla y los ayudantes de Proven Gigs.
Bilingüe (español / inglés), hecho para usarse desde el celular en la obra.

---

## Qué hay adentro

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `styles.css` | El diseño |
| `i18n.js` | Todos los textos en español e inglés |
| `api.js` | La conexión con la base de datos (y el modo de prueba) |
| `app.js` | La aplicación |
| `config.js` | **Aquí pegas las dos llaves de Supabase** |
| `schema.sql` | La base de datos: se pega una vez en Supabase |
| `logo-blanco.png`, `logo-dorado.png` | Logos |
| `CNAME` | El dominio: `portal.provensolutionseastcoast.com` |

---

## Este paquete va sin datos de prueba

Es el que se publica. **No trae proyectos, leads ni clientes adentro** — se los quité a
propósito: los archivos de un sitio web los puede abrir cualquiera, y el paquete de prueba
llevaba nombres de clientes, direcciones y montos de contrato en texto plano.

Si abres este portal sin haber llenado `config.js`, no vas a ver nada: te avisa que falta
conectar la base de datos. Eso es lo correcto.

Para mostrarle el portal a alguien sin conectar nada, usa el paquete de prueba
(`proven-portal.zip`), que sí trae los datos reales y vive solo en tu navegador.
Ese **no se publica**.

---

## Cómo se ve un proyecto

Al entrar a un proyecto, lo primero es **el scope**: en qué vamos, qué sigue, y cuántos días
quedan para terminar la tarea en curso. Si una tarea se termina antes de tiempo, sale
**"¡GANASTE 2 DÍAS!"**. Después viene el chat, los materiales y los recibos. **Equipo y horas
quedan de último** porque no son del día a día.

El foreman tiene su **checklist diario y semanal**, que se reinicia solo cada día y cada semana.

Debajo del scope hay un botón **MATERIALES NECESARIOS**: cualquiera de la obra puede pedir
un material y marcarlo cuando ya esté comprado.

## Selecciones del cliente

Lo que el cliente tiene que escoger — gabinetes, quartz, puertas, lámparas — con su **fecha
límite** arriba y en rojo cuando falte una semana. Cada selección lleva su **allowance** (lo
presupuestado) y su **costo real**; si lo que escogió se pasa, el portal lo marca en la fila
y en el total. Ahí es por donde se va la ganancia sin que nadie se dé cuenta.

Esta pestaña **solo la ve la oficina**. Ana ve los números pero no los cambia; la cuadrilla
no la ve.

## Cómo sabe el portal si vas ganando

Cada proyecto lleva el **valor del contrato**. El portal compara **cuánto llevas hecho del
scope** contra **cuánto llevas gastado**, y pinta el estado:

| | Margen |
|---|---|
| **GANANDO** | 30% o más |
| **EN GANANCIA** | entre 15% y 30% |
| **EN TABLAS** | entre 5% y 15% |
| **OJO** | entre 0% y 5% |
| **PERDIENDO PLATA** | por debajo de 0% |

Si el scope va en 50% y ya gastaste el 70% de la plata, te lo dice ahí mismo, no al final.
El gasto no incluye la mano de obra, salvo que la cargues como gasto.

**La cuadrilla no ve nada de esto.** Ellos ven el porcentaje de avance y su checklist.

## Gastos fijos

En Finanzas hay una sección aparte para lo que se paga pase lo que pase: seguros, bodega,
Google Workspace, el celular. Cada mes aparecen con su casilla; al marcar uno como pagado,
entra como gasto del mes y suma en los totales. Marcar dos veces el mismo mes no duplica nada.

## Los cuatro roles

- **Administradora (Juliana).** Todo. Es la única que aprueba gente, cambia permisos y registra pagos.
- **Oficina (Doris).** Maneja proyectos, turnos, documentos y corrige horas. **No** aprueba gente ni registra pagos.
- **Finanzas (Ana).** Ve todos los números y carga gastos. **No** aprueba gente, no cambia proyectos, no ve el CRM ni el contenido.
- **Trabajador.** Solo lo que la administradora le prenda, y solo de los proyectos donde está asignado.

El **foreman** de un proyecto ve las horas de su cuadrilla en ese proyecto, nada más.

---

## Lo que ya está protegido

Esto no es confianza, está probado contra la base de datos real:

- Nadie se aprueba a sí mismo ni se da permisos.
- Un trabajador no ve proyectos, chats, recibos ni horas de obras donde no está.
- Un trabajador no puede escribir horas a mano: el reloj usa la hora del servidor.
- Nadie puede firmar un mensaje con el nombre de otro.
- Dos personas no pueden tomar el mismo cupo de un turno.
- Ana no puede aprobar gente; Doris no puede registrar pagos.
- Reimportar el mismo estado de cuenta no duplica los gastos.

---

## Instalación (una sola vez)

### 1. Crear la base de datos

1. Entra a `supabase.com` y crea una cuenta.
2. Crea un proyecto nuevo. Elige la región **East US**.
3. Guarda la contraseña de la base de datos donde no se te pierda.
4. En el menú de la izquierda abre **SQL Editor**.
5. Haz clic en **New query**.
6. Abre `schema.sql`, copia **todo** el contenido y pégalo ahí.
7. Haz clic en **Run**. Debe decir *Success*.

### 2. Conectar el portal

1. En Supabase abre **Project Settings** → **API**.
2. Copia el valor de **Project URL**.
3. Abre `config.js` y pégalo entre las comillas de `SUPABASE_URL`.
4. Vuelve a Supabase y copia la llave **anon public**.
5. Pégala entre las comillas de `SUPABASE_ANON_KEY`.
6. Guarda el archivo.

> La llave `anon` es pública a propósito: no abre nada por sí sola, porque los permisos
> viven en la base de datos. La llave **service_role** nunca va en estos archivos.

### 3. Publicar la página

1. En GitHub crea un repositorio nuevo llamado `proven-portal`.
2. Súbele todos los archivos **de esta carpeta** (la limpia, no la de prueba).

> **El repositorio va a quedar público.** GitHub Pages gratis solo publica desde repositorios
> públicos; para uno privado hace falta GitHub Pro (unos $4 al mes) o cambiarse a Cloudflare
> Pages, que sí permite repositorio privado sin pagar.
>
> Público está bien **con este paquete**, porque no lleva datos de clientes y la llave `anon`
> es pública por diseño: lo que protege la información son los permisos de la base de datos,
> no el secreto del código. Lo que nunca puede subir es la llave `service_role`.
3. Entra a **Settings** → **Pages**.
4. En *Source* elige la rama `main` y la carpeta `/ (root)`.
5. En *Custom domain* escribe `portal.provensolutionseastcoast.com` y guarda.

### 4. Apuntar el dominio

> Esto ya lo hiciste una vez, para `links.provensolutionseastcoast.com`. Es el mismo
> procedimiento con otro subdominio: `portal` en vez de `links`. No se pisan.

1. Entra a Squarespace, a la sección de dominios.
2. Abre los registros DNS de `provensolutionseastcoast.com`.
3. Agrega un registro **CNAME**.
4. En *Host* escribe `portal`.
5. En *Data* escribe `mariaforbes-tech.github.io`.
6. Guarda y espera. Puede tardar unas horas.
7. Vuelve a GitHub Pages y marca **Enforce HTTPS** cuando aparezca disponible.

### 5. Volverte administradora

1. Abre el portal y haz clic en **Crear cuenta**.
2. Regístrate con tu correo de trabajo.
3. Vuelve a Supabase → **SQL Editor** → **New query**.
4. Pega esto, cambiando el correo por el tuyo:

```sql
update public.profiles
   set is_admin = true, status = 'approved',
       perms = '{"projects":true,"clock":true,"shifts":true,"docs":true,"pay":true}'
 where email = 'TU_CORREO@provensolutionseastcoast.com';
```

5. Haz clic en **Run**.
6. Recarga el portal. Ya tienes el centro de mando.

A Doris y a Ana las activas desde el portal, no desde Supabase: ellas se registran,
tú las apruebas y les prendes el interruptor de **Oficina** o **Finanzas**.

### 6. Que los correos salgan a nombre de Proven

Por defecto Supabase manda los correos de bienvenida y de clave olvidada desde su propio
servidor, y a veces caen en spam.

1. En Supabase abre **Authentication** → **Emails**.
2. Traduce las plantillas al español.
3. Si quieres que salgan desde `@provensolutionseastcoast.com`, configura SMTP ahí mismo.

---

## Documentos para firmar

El acuerdo de contratista que viene cargado es **texto de ejemplo**. Reemplázalo por el
que revise tu abogado antes de pedirle a nadie que lo firme:
**Documentos → Documentos requeridos → Editar**.

Una firma escrita en el portal queda guardada con el nombre, la fecha y la hora. Si
necesitas firma con validez legal reforzada, eso va por DocuSign o similar.

---

## Lo que sigue

1. **n8n** — el puente que corre solo: del portal al Google Sheet de Ana, del Gmail al CRM.
2. **Portal del cliente** — que el cliente vea el avance de su obra y sus facturas.
3. **Estimados y cuentas de cobro** — amarrarlo con lo que Ana ya tiene montado.
4. **Banco en vivo** — Plaid o Teller, cuando el portal ya esté en uso.

---

## Si algo se rompe

- **Entro y no veo nada:** tu cuenta está en espera. La administradora la aprueba desde el centro de mando.
- **No me llega el correo de confirmación:** revisa spam, o apaga la confirmación por correo en Supabase → Authentication → Providers → Email.
- **La página se ve sin estilo:** falta subir `styles.css` al repositorio.
- **Dice "Falta conectar la base de datos":** `config.js` está vacío o las llaves quedaron mal pegadas.
- **Entra pero no aparece ningún proyecto:** es normal recién instalado. La base arranca vacía;
  los proyectos se crean desde el portal.
