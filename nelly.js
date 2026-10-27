/* Nelly · documentos de Proven Solutions.
   Vive aparte de app.js y usa sus ayudantes a través de window.PS.

   Regla de oro: el PDF se arma desde la plantilla, con el texto fijo tal
   como está en el documento firmado. Nelly rellena datos, nunca redacta. */
(function () {
  'use strict';

  var NAVY = [27, 47, 91];        // #1B2F5B, el navy de los documentos
  var GOLD = [201, 168, 76];
  var GREY = [110, 110, 110];
  var HAIR = [222, 220, 214];

  var M = 54;                      // margen, 0.75 pulgadas
  var W = 612, H = 792;            // carta, en puntos
  var CW = W - M * 2;              // ancho útil

  /* ---------- carga perezosa: solo cuando se va a generar un PDF ---------- */
  function script(src) {
    return new Promise(function (ok, bad) {
      if (document.querySelector('script[data-ld="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.async = true; s.setAttribute('data-ld', src);
      s.onload = function () { ok(); };
      s.onerror = function () { bad(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }

  var ready = null;
  function ensure() {
    if (ready) return ready;
    ready = Promise.all([
      script('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      script('fonts/mont-400.js'),
      script('fonts/mont-700.js')
    ]);
    return ready;
  }

  /* El logo se entrega como {data, w, h} y no como la imagen suelta, para
     que el mismo código sirva dentro del navegador y fuera de él. */
  function logo() {
    return new Promise(function (ok) {
      var i = new Image();
      i.onload = function () { ok({ data: i, w: i.width, h: i.height }); };
      i.onerror = function () { ok(null); };   // sin logo antes que sin documento
      i.src = 'logo-dorado.png';
    });
  }

  /* ---------- el lienzo ---------- */
  function Sheet(d, img, co) {
    this.d = d; this.img = img; this.co = co || {}; this.y = M; this.page = 1;
    d.addFileToVFS('M400.ttf', window.MONT['400']); d.addFont('M400.ttf', 'M', 'normal');
    d.addFileToVFS('M700.ttf', window.MONT['700']); d.addFont('M700.ttf', 'M', 'bold');
    d.setFont('M', 'normal');
  }

  Sheet.prototype.font = function (size, bold, color) {
    this.d.setFont('M', bold ? 'bold' : 'normal');
    this.d.setFontSize(size);
    var c = color || NAVY;
    this.d.setTextColor(c[0], c[1], c[2]);
    return this;
  };

  Sheet.prototype.room = function (need) {
    if (this.y + need <= H - M - 34) return;
    this.d.addPage(); this.page++; this.y = M;
  };

  /* Encabezado: logo y datos de la empresa a la izquierda, tipo de
     documento, número y fechas a la derecha, como una factura normal. */
  Sheet.prototype.head = function (kind, number, rows, sub) {
    var top = this.y, lw = 152, hgt = 0;
    if (this.img) {
      hgt = lw * (this.img.h / this.img.w);
      this.d.addImage(this.img.data, 'PNG', M, top, lw, hgt);
    }
    /* Los datos de la empresa salen de la base, no del código: el
       repositorio es público y el EIN no tiene por qué estar ahí. */
    var co = this.co || {}, ly = top + hgt + (hgt ? 12 : 0), ty = ly + 8;
    this.font(9.5, true).d.text(co.legal_name || 'Proven Solutions USA LLC', M, ty);
    this.font(8.5, false, GREY);
    [co.address_1, co.address_2, co.phone, co.website,
     co.ein ? 'EIN ' + co.ein : ''].forEach(function (line) {
      if (!line) return;
      ty += 11;
      this.d.text(String(line), M, ty);
    }, this);
    var leftEnd = ty;

    var rx = W - M;
    this.font(22, true).d.text(kind, rx, top + 20, { align: 'right' });
    this.font(13, true, GOLD).d.text('#' + number, rx, top + 38, { align: 'right' });
    var ry = top + 58;
    (rows || []).forEach(function (r) {
      this.font(7, true, GREY).d.text(String(r[0]).toUpperCase(), rx, ry, { align: 'right' });
      this.font(9.5, false, NAVY).d.text(String(r[1] || '—'), rx, ry + 11, { align: 'right' });
      ry += 25;
    }, this);

    this.y = Math.max(leftEnd, ry) + 14;
    this.rule(true);
    this.y += 6;
    if (sub) {
      this.font(8.5, false, GREY).d.text(sub, M, this.y + 4);
      this.y += 14;
    }
    this.y += 10;
    return this;
  };

  Sheet.prototype.rule = function (gold) {
    var c = gold ? GOLD : HAIR;
    this.d.setDrawColor(c[0], c[1], c[2]);
    this.d.setLineWidth(gold ? 1.6 : 0.6);
    this.d.line(M, this.y, W - M, this.y);
    this.y += 6;
    return this;
  };

  Sheet.prototype.section = function (n, title) {
    this.room(46);
    this.y += 6;
    this.font(10.5, true).d.text(n + '. ' + title, M, this.y);
    this.y += 4;
    this.rule(true);
    this.y += 11;
    return this;
  };

  /* Pares etiqueta-valor en dos columnas. */
  Sheet.prototype.pairs = function (rows) {
    var self = this, col = CW / 2, lh = 24;
    rows.forEach(function (r, i) {
      self.room(lh);
      r.forEach(function (cell, j) {
        if (!cell) return;
        var x = M + col * j;
        self.font(7, true, GREY).d.text(String(cell[0]).toUpperCase(), x, self.y);
        self.font(10, false).d.text(String(cell[1] == null || cell[1] === '' ? '—' : cell[1]),
          x, self.y + 12, { maxWidth: col - 14 });
      });
      self.y += lh;
    });
    this.y += 2;
    return this;
  };

  /* Casillas: el documento marca una. */
  Sheet.prototype.checks = function (opts, picked) {
    var self = this, col = CW / 2, s = 8;
    for (var i = 0; i < opts.length; i += 2) {
      self.room(24);
      [opts[i], opts[i + 1]].forEach(function (o, j) {
        if (!o) return;
        var x = M + col * j, on = o.k === picked;
        self.d.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
        self.d.setLineWidth(0.8);
        self.d.rect(x, self.y - s + 1, s, s);
        if (on) {
          self.d.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
          self.d.rect(x + 2, self.y - s + 3, s - 4, s - 4, 'F');
        }
        self.font(9, on).d.text(o.t, x + s + 6, self.y, { maxWidth: col - s - 20 });
        if (o.sub) {
          self.font(7, false, GREY).d.text(o.sub, x + s + 6, self.y + 9, { maxWidth: col - s - 20 });
        }
      });
      self.y += 24;
    }
    return this;
  };

  /* Tabla de partidas. cols: [{t, w, a}] */
  Sheet.prototype.table = function (cols, rows, totals) {
    var self = this, x0 = M;
    /* Una tabla que cabe entera no se parte: un total huérfano en la página
       siguiente, separado de sus renglones, se lee como un error. */
    var est = (rows.length + (totals ? totals.length : 0)) * 24 + 40;
    if (est < H - M * 2 - 40) this.room(est);
    function row(cells, bold, bg) {
      self.font(9, bold);
      var parts = cells.map(function (c, i) {
        return self.d.splitTextToSize(String(c == null ? '' : c), cols[i].w - 12);
      });
      var lines = Math.max.apply(null, parts.map(function (p) { return p.length; }));
      var hgt = lines * 12 + 8;
      self.room(hgt);
      if (bg) {
        self.d.setFillColor(bg[0], bg[1], bg[2]);
        self.d.rect(M, self.y - 10, CW, hgt, 'F');
      }
      var x = x0;
      parts.forEach(function (p, i) {
        var col = cols[i], tx = col.a === 'r' ? x + col.w - 6 : x + 6;
        self.font(9, bold).d.text(p, tx, self.y + 2,
          { align: col.a === 'r' ? 'right' : 'left' });
        x += col.w;
      });
      self.y += hgt;
    }
    /* Sin encabezados no se dibuja la franja: una tabla de solo totales
       no tiene por qué dejar un hueco en blanco arriba. */
    if (cols.some(function (c) { return c.t; })) {
      this.font(7, true, GREY);
      var hx = x0;
      cols.forEach(function (c) {
        self.d.text(c.t.toUpperCase(), c.a === 'r' ? hx + c.w - 6 : hx + 6, self.y,
          { align: c.a === 'r' ? 'right' : 'left' });
        hx += c.w;
      });
      this.y += 5; this.rule(); this.y += 10;
    }
    rows.forEach(function (r) { row(r, false); });
    if (totals) {
      if (rows.length) { this.rule(); this.y += 10; }
      totals.forEach(function (tt, i) {
        row(tt, true, i === totals.length - 1 ? [246, 244, 238] : null);
      });
    }
    this.y += 6;
    return this;
  };

  Sheet.prototype.para = function (txt, size, bold, color) {
    var sz = size || 9;
    this.font(sz, bold, color);
    var lines = this.d.splitTextToSize(txt, CW);
    this.room(lines.length * (sz + 2.5) + 6);
    this.font(sz, bold, color).d.text(lines, M, this.y);
    this.y += lines.length * (sz + 2.5) + 5;
    return this;
  };

  Sheet.prototype.footer = function () {
    var d = this.d, n = d.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFont('M', 'normal'); d.setFontSize(7.5);
      d.setTextColor(GREY[0], GREY[1], GREY[2]);
      var co = this.co || {};
      d.text([co.legal_name || 'Proven Solutions USA LLC', co.phone || '(203) 249-0981',
        co.website || 'provensolutionseastcoast.com'].join('  |  ')
        + '  |  Page ' + i + ' of ' + n, W / 2, H - 34, { align: 'center' });
    }
    return this;
  };

  /* ================= INVOICE ================= */
  var FOR_OPTS = [
    { k: 'down',         t: 'Down Payment',         sub: 'per the down payment schedule in the Agreement' },
    { k: 'milestone',    t: 'Milestone Payment',    sub: 'per the milestone schedule in the Scope of Work / Estimate' },
    { k: 'final',        t: 'Final Payment',        sub: 'balance due at project completion' },
    { k: 'change_order', t: 'Change Order',         sub: '50% at signing; remaining 50% rolls into the final payment' },
    { k: 'material',     t: 'Material Upgrade',     sub: 'issued the Monday after purchase — Net 7 days' },
    { k: 'subscription', t: 'Subscription / Recurring', sub: '100% prepaid monthly — due by the 10th' }
  ];

  function buildInvoice(v, img) {
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var s = new Sheet(d, img, v.co);
    var m = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    s.head('INVOICE', v.number,
      [['Invoice date', v.date], ['Due date', v.due]],
      'Issued under the signed Services Agreement.');

    /* Las fechas ya van en el encabezado: repetirlas aquí solo da lugar a
       que un día no coincidan. */
    s.section(1, 'BILL TO & PROJECT');
    s.pairs([
      [['Bill to — Client Full Legal Name', v.bill.name], ['Project Address', v.project.address]],
      [['Client Address', v.bill.address], ['Original Contract Date', v.project.contract_date]],
      [['Client Email', v.bill.email], ['Client Phone', v.bill.phone]]
    ]);

    s.section(2, 'THIS INVOICE IS FOR');
    s.font(8, false, GREY).d.text('Mark one:', M, s.y); s.y += 14;
    var opts = FOR_OPTS.map(function (o) {
      return o.k === 'change_order' && v.co_number
        ? { k: o.k, t: o.t + ' #' + v.co_number, sub: o.sub } : o;
    });
    s.checks(opts, v.for);

    s.section(3, 'CHARGES');
    s.table(
      [{ t: 'Description of Work / Material', w: CW - 190 }, { t: 'Qty', w: 50, a: 'r' },
       { t: 'Unit Price', w: 70, a: 'r' }, { t: 'Line Total', w: 70, a: 'r' }],
      v.items.map(function (i) {
        return [i.desc, i.qty == null ? '' : String(i.qty),
                i.unit == null ? '' : m(i.unit), m(i.total)];
      }),
      [['Subtotal', '', '', m(v.subtotal)]]
        .concat(Number(v.tax) ? [['Sales tax (material purchases)', '', '', m(v.tax)]] : [])
        .concat([['INVOICE TOTAL DUE', '', '', m(v.total)]])
    );

    s.section(4, 'ACCOUNT SUMMARY');
    s.table(
      [{ t: '', w: CW - 120 }, { t: '', w: 120, a: 'r' }],
      [['Original Contract Amount', m(v.sum.contract)],
       ['Approved Change Orders (total to date)', m(v.sum.cos)],
       ['Total Paid to Date (before this invoice)', m(v.sum.paid)],
       ['This Invoice', m(v.total)]],
      [['REMAINING BALANCE AFTER THIS INVOICE', m(v.sum.balance_after)]]
    );

    s.section(5, 'HOW TO PAY');
    s.para('Zelle: Provensolutionsusa@gmail.com', 9, true);
    s.para('ACH / wire / certified check (payable to Proven Solutions USA LLC): contact us for instructions at (203) 249-0981.');
    s.para('Credit card: a processing surcharge may apply, as stated in the Agreement.');
    s.para('Please include the Invoice # in the payment memo.', 9, true);

    s.section(6, 'PAYMENT TERMS');
    s.para('LATE PAYMENT. As stated in the signed Services Agreement, an invoice not paid in full by its due date accrues interest at 1% per day (simple interest) on the outstanding balance, beginning the day after the due date, and is subject to the Stop-Work provision (Section 5): no Proven crew reports to the site until the balance is paid.', 8.5);
    s.para('Subscription invoices follow Section 4.2 of the Agreement (due by the 10th of the month; service is suspended if unpaid). Material Upgrade invoices are due Net 7 days.', 8.5);
    if (v.notes) { s.y += 4; s.para('Notes: ' + v.notes, 8.5, false, GREY); }

    s.y += 10; s.rule();
    s.y += 12;
    s.font(8.5, false, GREY).d.text(
      'Thank you for choosing Proven Solutions  •  Proven solutions for you. No surprises.',
      W / 2, s.y, { align: 'center' });

    s.footer();
    return d;
  }

  /* ================= RECEIPT ================= */
  var METHODS = [
    { k: 'zelle', t: 'Zelle' }, { k: 'ach', t: 'ACH / Wire Transfer' },
    { k: 'check', t: 'Check' }, { k: 'card', t: 'Credit Card' },
    { k: 'cash', t: 'Cash' }, { k: 'other', t: 'Other' }
  ];

  function buildReceipt(v, img) {
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var s = new Sheet(d, img, v.co);
    var m = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    s.head('PAYMENT RECEIPT', v.number,
      [['Payment received', v.received_on], ['Date issued', v.issued_on]],
      'Proof of payment received.');

    s.font(10.5, true).d.text('PAYMENT RECEIVED — THANK YOU', M, s.y); s.y += 14;
    s.para('Proven Solutions USA LLC acknowledges receipt of the payment described below, applied to the signed Services Agreement identified on this receipt.', 9, false, GREY);

    s.section(1, 'RECEIVED FROM');
    s.pairs([
      [['Client Full Legal Name', v.bill.name], ['Project Address', v.project.address]],
      [['Original Contract Date', v.project.contract_date], ['Invoice # Paid (if any)', v.invoice_number]]
    ]);

    s.section(2, 'AMOUNT RECEIVED');
    s.table([{ t: '', w: CW - 140 }, { t: '', w: 140, a: 'r' }], [],
      [['TOTAL AMOUNT RECEIVED', m(v.amount)]]);

    s.section(3, 'PAYMENT METHOD');
    s.font(8, false, GREY).d.text('Mark one:', M, s.y); s.y += 14;
    s.checks(METHODS.map(function (o) {
      return o.k === 'check' && v.check_number
        ? { k: o.k, t: o.t, sub: 'check # ' + v.check_number } : o;
    }), v.method);
    s.pairs([[['Reference / Confirmation #', v.reference], null]]);

    s.section(4, 'PAYMENT APPLIED TO');
    s.font(8, false, GREY).d.text('Mark one:', M, s.y); s.y += 14;
    s.checks(FOR_OPTS.map(function (o) {
      return o.k === 'change_order' && v.co_number
        ? { k: o.k, t: o.t, sub: 'Change Order # ' + v.co_number } : { k: o.k, t: o.t };
    }), v.applied_to);

    s.section(5, 'ACCOUNT STATUS AFTER THIS PAYMENT');
    s.table([{ t: '', w: CW - 120 }, { t: '', w: 120, a: 'r' }],
      [['Original Contract Amount', m(v.sum.contract)],
       ['Approved Change Orders (total to date)', m(v.sum.cos)],
       ['Total Paid to Date (including this payment)', m(v.sum.paid)]],
      [['REMAINING BALANCE', m(v.sum.balance)]]);

    s.section(6, 'ISSUED BY');
    s.pairs([[['Issued by — Printed Name', v.issued_by], ['Date Issued', v.issued_on]]]);

    s.y += 8;
    s.para('This receipt confirms payment only. It does not waive any right or obligation under the signed Services Agreement, including any Change Order, remaining balance, or Stop-Work provision. Payments received are held in trust under Article 3-A of the New York Lien Law, as stated in the Agreement.', 8.5, false, GREY);

    s.y += 6; s.rule(); s.y += 12;
    s.font(8.5, false, GREY).d.text(
      'Thank you for choosing Proven Solutions  •  Proven solutions for you. No surprises.',
      W / 2, s.y, { align: 'center' });

    s.footer();
    return d;
  }

  /* ---------- lo que el resto del portal puede llamar ---------- */
  window.NELLY = {
    ensure: ensure,
    logo: logo,
    buildInvoice: buildInvoice,
    buildReceipt: buildReceipt,
    FOR_OPTS: FOR_OPTS,
    METHODS: METHODS,
    view: view
  };

  /* ================= LA PANTALLA ================= */
  var h, fill, modal, toast, run, money, field, ico, empty, t, sb;
  function bind() {
    P = window.PS;
    h = P.h; fill = P.fill; modal = P.modal; toast = P.toast; run = P.run;
    money = P.money; field = P.field; ico = P.ico; empty = P.empty; t = P.t;
    sb = window.API && window.API.sb;
  }

  function q(p) {
    return p.then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var D = {
    company: function () { return q(sb.from('company').select('*').eq('id', 1).maybeSingle()); },
    projects: function () {
      return q(sb.from('projects').select('*').order('starts_on', { ascending: false }));
    },
    payments: function (pid) {
      return q(sb.from('client_payments').select('*').eq('project_id', pid).order('sort'));
    },
    summary: function (pid) { return q(sb.rpc('account_summary', { p_project: pid })); },
    number: function (kind) { return q(sb.rpc('next_doc_number', { p_kind: kind })); },
    save: function (row) { return q(sb.from('documents').insert(row).select().single()); },
    recent: function () {
      return q(sb.from('documents').select('*').order('created_at', { ascending: false }).limit(12));
    },
    markPaid: function (id, on) {
      return q(sb.from('client_payments').update({ paid_on: on }).eq('id', id));
    }
  };

  var MONTHS = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];
  function longDate(iso) {
    if (!iso) return '';
    var p2 = String(iso).slice(0, 10).split('-');
    return MONTHS[Number(p2[1]) - 1] + ' ' + Number(p2[2]) + ', ' + p2[0];
  }
  function addDays(iso, n) {
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return P.dkey(d);
  }

  /* ---------- el saludo y las opciones ---------- */
  var MENU = [
    { k: 'estimate', t: 'Hacer un estimado', d: 'Lee las fotos y arma el PDF.', soon: true },
    { k: 'estimate_edit', t: 'Modificar un estimado', d: 'Busca uno y lo abre para cambiarlo.', soon: true },
    { k: 'contract', t: 'Hacer el contrato', d: 'Saca los datos del estimado.', soon: true },
    { k: 'change_order', t: 'Hacer un change order', d: 'Cuelga del contrato.', soon: true },
    { k: 'invoice', t: 'Hacer un invoice', d: 'El portal calcula, tú confirmas.' },
    { k: 'receipt', t: 'Hacer un receipt', d: 'Cuando el cliente ya pagó.' }
  ];

  function view(main) {
    bind();
    /* Si falta algo del portal, se dice cuál: una pantalla en blanco no
       le sirve a nadie. */
    if (!P) { document.getElementById('main').textContent = 'Nelly no encontró el portal.'; return; }
    if (!sb) { fill(main, empty('Nelly', 'No hay conexión con la base de datos.')); return; }
    fill(main, P.h('div', { class: 'spin' }));
    Promise.all([D.company(), D.projects(), D.recent().catch(function () { return []; })])
      .then(function (r) {
        var ctx = { co: r[0] || {}, projects: r[1] || [], recent: r[2] || [] };
        home(main, ctx);
      })
      .catch(function (e) {
        fill(main, empty('Nelly', P.errText(e) + ' — ¿ya corriste nelly-1-documentos.sql?'));
      });
  }

  function robot(line) {
    return h('div', { class: 'nelly-hi' },
      h('div', { class: 'bot' }, '🤖'),
      h('div', null,
        h('b', null, '¿Qué vamos a hacer hoy?'),
        h('p', { class: 'mut sm' }, line || 'Escoge una y yo pregunto solo lo que falte.')));
  }

  function home(main, ctx) {
    var cards = MENU.map(function (m) {
      var el = h('button', {
        class: 'nelly-card' + (m.soon ? ' soon' : ''), type: 'button',
        disabled: m.soon ? 'disabled' : null
      }, h('b', null, m.t), h('small', null, m.d),
        m.soon ? h('span', { class: 'chip mut' }, 'Pronto') : null);
      if (!m.soon) {
        el.onclick = function () {
          if (m.k === 'invoice') invoiceFlow(main, ctx);
          else receiptFlow(main, ctx);
        };
      }
      return el;
    });

    var recent = ctx.recent.length
      ? h('div', { class: 'list' }, ctx.recent.map(function (d) {
          var pr = ctx.projects.filter(function (x) { return x.id === d.project_id; })[0];
          return h('div', { class: 'card lrow slim' },
            h('span', null,
              h('b', null, KIND[d.kind] + ' #' + d.number),
              h('small', null, [pr ? pr.name : '', d.issued_on ? longDate(d.issued_on) : '',
                d.total != null ? money(d.total) : ''].filter(Boolean).join(' · '))),
            P.chip(ST[d.status] || d.status, d.status === 'void' ? 'bad' : 'ok'));
        }))
      : h('p', { class: 'mut small' }, 'Todavía no hay documentos.');

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Nelly')),
      robot(),
      h('div', { class: 'nelly-grid' }, cards),
      h('div', { class: 'sech' }, h('h3', null, 'Últimos documentos')),
      recent);
  }

  var KIND = { estimate: 'Estimado', contract: 'Contrato', change_order: 'Change order',
    invoice: 'Invoice', receipt: 'Receipt' };
  var ST = { draft: 'Borrador', issued: 'Emitido', signed: 'Firmado', paid: 'Pagado', void: 'Anulado' };

  /* ---------- escoger proyecto, con buscador ---------- */
  function pickProject(main, ctx, title, next) {
    var box = h('div', { class: 'list' });
    var find = h('input', { type: 'search', placeholder: 'Buscar por proyecto, cliente o dirección…' });
    function draw() {
      var s2 = find.value.trim().toLowerCase();
      var list = ctx.projects.filter(function (p2) {
        if (!s2) return true;
        return [p2.name, p2.client, p2.address].join(' ').toLowerCase().indexOf(s2) >= 0;
      });
      fill(box, list.length ? list.map(function (p2) {
        var el = h('button', { class: 'card lrow slim pick', type: 'button' },
          h('span', null, h('b', null, p2.name),
            h('small', null, [p2.client, p2.address].filter(Boolean).join(' · '))),
          h('b', null, p2.contract != null ? money(p2.contract) : '—'));
        el.onclick = function () { next(p2); };
        return el;
      }) : h('p', { class: 'mut small' }, 'Ningún proyecto coincide.'));
    }
    find.oninput = draw;
    draw();
    var back = h('button', { class: 'lnk', type: 'button' }, '← Volver');
    back.onclick = function () { home(main, ctx); };
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, title), back),
      robot('¿Para qué proyecto?'),
      h('div', { class: 'mb' }, find),
      box);
  }

  /* ---------- lo que comparten los dos documentos ---------- */
  function base(ctx, pr) {
    return {
      co: ctx.co,
      bill: {
        name: pr.client_legal_name || pr.client || '',
        address: pr.client_address || pr.address || '',
        email: pr.client_email || '', phone: pr.client_phone || ''
      },
      project: { address: pr.address || '', contract_date: longDate(pr.contract_date) }
    };
  }

  function missing(pr) {
    var f = [];
    if (!pr.client_legal_name) f.push('nombre legal del cliente');
    if (!pr.client_address) f.push('dirección del cliente');
    if (!pr.contract_date) f.push('fecha del contrato');
    return f;
  }

  /* Emite: saca el número, arma el PDF, lo descarga y lo deja guardado. */
  function emit(kind, pr, v, extra) {
    return ensure().then(logo).then(function (img) {
      return D.number(kind).then(function (num) {
        v.number = num;
        var doc = kind === 'invoice' ? buildInvoice(v, img) : buildReceipt(v, img);
        doc.save('Proven-' + (kind === 'invoice' ? 'Invoice' : 'Receipt') + '-' + num + '.pdf');
        var row = {
          kind: kind, number: num, project_id: pr.id, status: 'issued',
          issued_on: P.dkey(new Date()), total: v.total || v.amount || 0, body: v
        };
        if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
        return D.save(row);
      });
    });
  }

  function summaryCard(sum, title) {
    return h('div', { class: 'card' },
      h('h3', null, title || 'Resumen de cuenta'),
      h('div', { class: 'list' }, [
        ['Contrato original', sum.contract_original],
        ['Change orders aprobados', sum.change_orders],
        ['Facturado a la fecha', sum.invoiced],
        ['Cobrado a la fecha', sum.paid],
        ['Saldo', sum.balance]
      ].map(function (r, i) {
        return h('div', { class: 'lrow slim' + (i === 4 ? ' tot' : '') },
          h('span', null, r[0]), h('b', null, money(r[1])));
      })));
  }

  /* ================= INVOICE ================= */
  function invoiceFlow(main, ctx) {
    pickProject(main, ctx, 'Invoice', function (pr) {
      fill(main, h('div', { class: 'spin' }));
      Promise.all([D.payments(pr.id), D.summary(pr.id)]).then(function (r) {
        invoiceForm(main, ctx, pr, r[0] || [], (r[1] || [])[0] || {});
      }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
    });
  }

  function invoiceForm(main, ctx, pr, pays, sum, keep) {
    var faltan = missing(pr);
    var today = P.dkey(new Date());
    var st = keep || { for: 'milestone', date: today, due: addDays(today, 7),
      items: [], tax: 0, notes: '', payment_id: null, reason: '' };

    var open = pays.filter(function (x) { return !x.paid_on; });
    var sel = h('select', null,
      [h('option', { value: '' }, 'Otro cobro, lo escribo yo')].concat(
        open.map(function (x) {
          return h('option', { value: x.id }, P.L(x, 'label') + ' — ' + money(x.amount));
        })));
    sel.value = st.payment_id || '';

    var fdate = h('input', { type: 'date', value: st.date });
    var fdue = h('input', { type: 'date', value: st.due });
    var ftax = h('input', { type: 'number', step: '0.01', min: '0', value: String(st.tax || 0) });
    var fnotes = h('textarea', { rows: 2 }, st.notes);
    var forSel = h('select', null, FOR_OPTS.map(function (o) {
      return h('option', { value: o.k }, o.t);
    }));
    forSel.value = st.for;

    var rowsBox = h('div', { class: 'list' });
    function itemRow(it) {
      var d1 = h('input', { value: it.desc || '', placeholder: 'Qué se cobra' });
      var q1 = h('input', { type: 'number', step: '0.01', value: it.qty == null ? 1 : it.qty });
      var u1 = h('input', { type: 'number', step: '0.01', value: it.unit == null ? '' : it.unit });
      var del = h('button', { class: 'ib', type: 'button', 'aria-label': 'Quitar este renglón' }, '\u00D7');
      var el = h('div', { class: 'card lrow slim nelly-item' },
        d1, q1, u1, del);
      el._read = function () {
        var qn = Number(q1.value) || 0, un = Number(u1.value) || 0;
        return { desc: d1.value.trim(), qty: qn, unit: un, total: Math.round(qn * un * 100) / 100 };
      };
      del.onclick = function () { el.remove(); };
      return el;
    }
    function addItem(it) { rowsBox.append(itemRow(it || {})); }
    (st.items.length ? st.items : [{}]).forEach(addItem);

    sel.onchange = function () {
      var x = open.filter(function (o) { return o.id === sel.value; })[0];
      if (!x) return;
      fill(rowsBox);
      addItem({ desc: P.L(x, 'label'), qty: 1, unit: Number(x.amount) });
      if (x.due_on) { fdue.value = x.due_on; }
    };

    var add = h('button', { class: 'btn ghost sm', type: 'button' }, ico('plus', 15), 'Otro renglón');
    add.onclick = function () { addItem({}); };

    var go = h('button', { class: 'btn', type: 'button' }, 'Revisar antes de generar');
    go.onclick = function () {
      var items = Array.prototype.map.call(rowsBox.children, function (el) { return el._read(); })
        .filter(function (i) { return i.desc || i.total; });
      if (!items.length) { toast('Falta al menos un renglón.', true); return; }
      var sub = items.reduce(function (a, i) { return a + i.total; }, 0);
      var tax = Number(ftax.value) || 0;
      invoiceConfirm(main, ctx, pr, pays, sum, {
        for: forSel.value, date: fdate.value, due: fdue.value,
        items: items, subtotal: Math.round(sub * 100) / 100, tax: tax,
        total: Math.round((sub + tax) * 100) / 100,
        notes: fnotes.value.trim(), payment_id: sel.value || null, reason: st.reason
      });
    };
    var back = h('button', { class: 'lnk', type: 'button' }, '← Volver');
    back.onclick = function () { home(main, ctx); };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Invoice · ' + pr.name), back),
      faltan.length ? h('p', { class: 'mut sm warnline' },
        'Al proyecto le falta: ' + faltan.join(', ') + '. El documento sale igual, pero esos campos van vacíos.') : null,
      robot('Escoge qué se cobra. Lo demás lo traigo yo.'),
      summaryCard(sum),
      h('div', { class: 'card' },
        field('Qué cuota se cobra', sel),
        h('div', { class: 'two' }, field('Tipo de cobro', forSel), field('Impuesto sobre materiales ($)', ftax)),
        h('div', { class: 'two' }, field('Fecha del invoice', fdate), field('Vence', fdue)),
        h('div', { class: 'sech' }, h('h3', null, 'Renglones'), add),
        rowsBox,
        field('Notas', fnotes),
        h('div', { class: 'acts' }, go)));
  }

  function invoiceConfirm(main, ctx, pr, pays, sum, v) {
    var sched = pays.filter(function (x) { return x.id === v.payment_id; })[0];
    var diff = sched ? Math.round((v.total - Number(sched.amount)) * 100) / 100 : 0;
    var reason = h('textarea', { rows: 2, placeholder: 'Por qué el monto es distinto' }, v.reason || '');

    var fix = h('button', { class: 'btn ghost', type: 'button' }, 'Cambiar datos');
    fix.onclick = function () { invoiceForm(main, ctx, pr, pays, sum, v); };

    var gen = h('button', { class: 'btn', type: 'button' }, 'Generar el PDF');
    gen.onclick = function () {
      if (diff && !reason.value.trim()) {
        toast('Escribe por qué el monto es distinto al de la cuota.', true);
        reason.focus(); return;
      }
      run(gen, function () {
        v.reason = reason.value.trim();
        var d = base(ctx, pr);
        d.date = longDate(v.date); d.due = longDate(v.due);
        d.for = v.for; d.co_number = '';
        d.items = v.items; d.subtotal = v.subtotal; d.tax = v.tax; d.total = v.total;
        d.notes = v.notes;
        d.sum = {
          contract: sum.contract_original, cos: sum.change_orders, paid: sum.paid,
          balance_after: Math.round((Number(sum.balance) - 0) * 100) / 100
        };
        d.reason = v.reason;
        return emit('invoice', pr, d, { payment_id: v.payment_id, due_on: v.due })
          .then(function () {
            toast('Invoice emitido. El PDF se descargó.');
            view(main);
          });
      });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar')),
      robot('Una vez lo genere, el documento no se edita. Si algo está mal, cámbialo ahora.'),
      h('div', { class: 'card' },
        h('h3', null, pr.name),
        h('div', { class: 'list' }, v.items.map(function (i) {
          return h('div', { class: 'lrow slim' },
            h('span', null, h('b', null, i.desc), h('small', null, i.qty + ' × ' + money(i.unit))),
            h('b', null, money(i.total)));
        })),
        h('div', { class: 'lrow slim' }, h('span', null, 'Subtotal'), h('b', null, money(v.subtotal))),
        v.tax ? h('div', { class: 'lrow slim' }, h('span', null, 'Impuesto'), h('b', null, money(v.tax))) : null,
        h('div', { class: 'lrow slim tot' }, h('span', null, 'TOTAL A COBRAR'), h('b', null, money(v.total))),
        h('p', { class: 'mut sm' }, 'Fecha ' + longDate(v.date) + ' · vence ' + longDate(v.due))),
      sched ? h('div', { class: 'card' },
        h('p', { class: 'mut sm' }, 'La cuota programada es ' + P.L(sched, 'label') + ' por ' + money(sched.amount) + '.'),
        diff ? h('div', null,
          h('p', { class: 'mut sm warnline' },
            'Estás cobrando ' + money(Math.abs(diff)) + (diff > 0 ? ' de más.' : ' de menos.')
            + ' Escribe por qué: queda guardado con el invoice.'),
          field('Razón', reason)) : h('p', { class: 'mut sm' }, 'Coincide con la cuota.')) : null,
      summaryCard(sum),
      h('div', { class: 'acts' }, fix, gen));
  }

  /* ================= RECEIPT ================= */
  function receiptFlow(main, ctx) {
    pickProject(main, ctx, 'Receipt', function (pr) {
      var si = h('button', { class: 'btn big', type: 'button' }, 'Sí, ya pagó');
      var no = h('button', { class: 'btn ghost big', type: 'button' }, 'Todavía no');
      no.onclick = function () {
        toast('Entonces no va recibo. El recibo es la constancia de que el dinero ya entró.', true);
        home(main, ctx);
      };
      si.onclick = function () {
        fill(main, h('div', { class: 'spin' }));
        Promise.all([D.payments(pr.id), D.summary(pr.id)]).then(function (r) {
          receiptForm(main, ctx, pr, r[0] || [], (r[1] || [])[0] || {});
        }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
      };
      fill(main,
        h('div', { class: 'sech' }, h('h2', null, 'Receipt · ' + pr.name)),
        h('div', { class: 'card nelly-ask' },
          h('h3', null, '¿El cliente ya hizo el pago?'),
          h('p', { class: 'mut sm' }, 'Un recibo se emite después de que el dinero entró, nunca antes.'),
          h('div', { class: 'acts' }, si, no)));
    });
  }

  function receiptForm(main, ctx, pr, pays, sum) {
    var today = P.dkey(new Date());
    var open = pays.filter(function (x) { return !x.paid_on; });
    var sel = h('select', null, [h('option', { value: '' }, 'Otro pago')].concat(
      open.map(function (x) {
        return h('option', { value: x.id }, P.L(x, 'label') + ' — ' + money(x.amount));
      })));
    var amount = h('input', { type: 'number', step: '0.01', min: '0', placeholder: '0.00' });
    var when = h('input', { type: 'date', value: today });
    var method = h('select', null, METHODS.map(function (m) {
      return h('option', { value: m.k }, m.t);
    }));
    var check = h('input', { placeholder: 'Número del cheque' });
    var ref = h('input', { placeholder: 'Número de confirmación' });
    var applied = h('select', null, FOR_OPTS.map(function (o) {
      return h('option', { value: o.k }, o.t);
    }));
    var invno = h('input', { placeholder: 'Número del invoice que paga' });
    var shot = h('input', { type: 'file', accept: 'image/*' });
    var issued = h('input', { value: (P.S.me && P.S.me.full_name) || '' });

    sel.onchange = function () {
      var x = open.filter(function (o) { return o.id === sel.value; })[0];
      if (x) { amount.value = Number(x.amount); }
    };
    method.onchange = function () { check.closest('.fld').hidden = method.value !== 'check'; };

    var go = h('button', { class: 'btn', type: 'button' }, 'Revisar antes de generar');
    go.onclick = function () {
      var amt = Number(amount.value) || 0;
      if (!amt) { toast('Falta el monto recibido.', true); amount.focus(); return; }
      if (!ref.value.trim() && method.value !== 'cash') {
        toast('Falta el número de confirmación. Es lo que prueba el pago.', true);
        ref.focus(); return;
      }
      receiptConfirm(main, ctx, pr, pays, sum, {
        payment_id: sel.value || null, amount: amt, received_on: when.value,
        method: method.value, check_number: check.value.trim(), reference: ref.value.trim(),
        applied_to: applied.value, invoice_number: invno.value.trim(),
        issued_by: issued.value.trim(), file: shot.files && shot.files[0]
      });
    };
    var back = h('button', { class: 'lnk', type: 'button' }, '← Volver');
    back.onclick = function () { home(main, ctx); };

    var chk = field('Número del cheque', check);
    chk.hidden = true;

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Receipt · ' + pr.name), back),
      robot('Dime cómo entró la plata y con qué número de confirmación.'),
      summaryCard(sum),
      h('div', { class: 'card' },
        field('Qué cuota paga', sel),
        h('div', { class: 'two' }, field('Monto recibido ($)', amount), field('Fecha en que entró', when)),
        h('div', { class: 'two' }, field('Método', method), field('A qué se aplica', applied)),
        chk,
        h('div', { class: 'two' }, field('Número de confirmación', ref), field('Invoice que paga', invno)),
        field('Pantallazo del pago', shot),
        field('Lo emite', issued),
        h('div', { class: 'acts' }, go)));
  }

  function receiptConfirm(main, ctx, pr, pays, sum, v) {
    var mName = METHODS.filter(function (m) { return m.k === v.method; })[0];
    var aName = FOR_OPTS.filter(function (o) { return o.k === v.applied_to; })[0];
    var fix = h('button', { class: 'btn ghost', type: 'button' }, 'Cambiar datos');
    fix.onclick = function () { receiptForm(main, ctx, pr, pays, sum); };

    var gen = h('button', { class: 'btn', type: 'button' }, 'Generar el PDF');
    gen.onclick = function () {
      run(gen, function () {
        var paidNow = Math.round((Number(sum.paid) + v.amount) * 100) / 100;
        var d = base(ctx, pr);
        d.received_on = longDate(v.received_on);
        d.issued_on = longDate(P.dkey(new Date()));
        d.issued_by = v.issued_by;
        d.invoice_number = v.invoice_number;
        d.amount = v.amount; d.method = v.method; d.check_number = v.check_number;
        d.reference = v.reference; d.applied_to = v.applied_to; d.co_number = '';
        d.sum = {
          contract: sum.contract_original, cos: sum.change_orders, paid: paidNow,
          balance: Math.round((Number(sum.contract_original) + Number(sum.change_orders) - paidNow) * 100) / 100
        };
        var up = Promise.resolve(null);
        if (v.file) {
          var path = pr.id + '/' + Date.now() + '-pago';
          up = sb.storage.from('project-files').upload(path, v.file, { contentType: v.file.type })
            .then(function (r) { return r.error ? null : path; })
            .catch(function () { return null; });
        }
        return up.then(function (proof) {
          d.proof_path = proof || '';
          return emit('receipt', pr, d, { payment_id: v.payment_id, status: 'paid' });
        }).then(function () {
          if (v.payment_id) return D.markPaid(v.payment_id, v.received_on).catch(function () {});
        }).then(function () {
          toast('Receipt emitido. El PDF se descargó.');
          view(main);
        });
      });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar')),
      robot('Una vez emitido, el recibo no se edita. Si algo está mal, cámbialo ahora.'),
      h('div', { class: 'card' },
        h('div', { class: 'lrow slim tot' }, h('span', null, 'RECIBIDO'), h('b', null, money(v.amount))),
        h('div', { class: 'list' }, [
          ['Fecha en que entró', longDate(v.received_on)],
          ['Método', mName ? mName.t : v.method],
          v.check_number ? ['Cheque', v.check_number] : null,
          ['Confirmación', v.reference || '—'],
          ['Se aplica a', aName ? aName.t : v.applied_to],
          ['Invoice', v.invoice_number || '—'],
          ['Pantallazo', v.file ? v.file.name : 'sin pantallazo'],
          ['Lo emite', v.issued_by || '—']
        ].filter(Boolean).map(function (r) {
          return h('div', { class: 'lrow slim' }, h('span', null, r[0]), h('b', null, r[1]));
        }))),
      h('div', { class: 'acts' }, fix, gen));
  }
})();
