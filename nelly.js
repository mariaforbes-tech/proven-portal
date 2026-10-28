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
      this.font(9.5, false, NAVY).d.text(String(r[1] || '-'), rx, ry + 11, { align: 'right' });
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

  /* `need` es cuánto ocupa lo que viene DEBAJO del título. Un título solo
     al pie de una página no es un título, es un error de impresión: el
     lector pasa la hoja buscando algo que se quedó atrás. Si no se dice
     nada se reservan dos líneas, que ya evita el caso feo. */
  Sheet.prototype.section = function (n, title, need) {
    var tope = H - M * 2 - 80;        // nunca pedir más de lo que cabe
    this.room(46 + Math.min(need == null ? 44 : need, tope));
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
        self.font(10, false).d.text(String(cell[1] == null || cell[1] === '' ? '-' : cell[1]),
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
      [['Bill to, client full legal name', v.bill.name], ['Project Address', v.project.address]],
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

  /* El estimado, con el formato de los tuyos: la cantidad va dentro de la
     descripción y no en una columna aparte, labor y materiales en tablas
     independientes, y nunca aparece lo que te cuesta. */
  function buildEstimate(v, img) {
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var s = new Sheet(d, img, v.co);
    var m = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    s.head('ESTIMATE', v.number,
      [['Date', longDate(v.fecha)], ['Valid for', v.validez + ' days']],
      v.titulo);

    var n = 0;
    s.section(++n, 'PREPARED FOR');
    s.pairs([[['Client', v.bill.name || ''], ['Project Address', v.bill.address || '']]]);

    if (v.resumen) {
      s.section(++n, 'SCOPE OF WORK');
      s.para(v.resumen);
    }

    function desc(f) {
      var t = String(f.desc || '');
      var q = Number(f.cantidad) || 0;
      if (q && f.unidad && t.indexOf(String(q)) < 0) t += ', ' + q + ' ' + f.unidad;
      return t;
    }
    var COLS = [{ t: 'Description', w: CW - 110 }, { t: 'Amount', w: 110, a: 'r' }];

    var bloques = [
      { k: 'labor',    t: 'LABOR',                 tot: 'LABOR TOTAL' },
      { k: 'material', t: 'MATERIALS',             tot: 'MATERIALS TOTAL' },
      { k: 'sub',      t: 'SUBCONTRACTED WORK',    tot: 'SUBCONTRACTED TOTAL' },
      { k: 'otro',     t: 'OTHER PROJECT COSTS',   tot: 'OTHER COSTS TOTAL' }
    ];
    var resumenFilas = [];
    bloques.forEach(function (b) {
      var mias = v.filas.filter(function (f) { return f.grupo === b.k; });
      if (!mias.length) return;
      var sub = Math.round(mias.reduce(function (a, f) { return a + (Number(f.precio) || 0); }, 0) * 100) / 100;
      /* El título viaja con su encabezado, sus renglones y su total. */
      s.section(++n, b.t, 15 + mias.length * 22 + 34);
      s.table(COLS,
        mias.map(function (f) { return [desc(f), m(f.precio)]; }),
        [[b.tot, m(sub)]]);
      resumenFilas.push([b.t.charAt(0) + b.t.slice(1).toLowerCase(), m(sub)]);
    });

    s.section(++n, 'ESTIMATE TOTAL');
    s.table([{ t: '', w: CW - 110 }, { t: '', w: 110, a: 'r' }],
      resumenFilas, [['TOTAL', m(v.totales ? v.totales.total : 0)]]);

    if (v.excluye && v.excluye.length) {
      s.section(++n, 'NOT INCLUDED');
      v.excluye.forEach(function (x) { s.para('- ' + x, 9); });
    }

    s.section(++n, 'TERMS');
    s.para('VALID FOR ' + v.validez + ' days from date of issue.', 9, true);
    s.para(v.formato === 'A'
      ? 'Payment schedule: 30 percent at signing, 25 percent at phase one, 30 percent at phase two, 15 percent at completion.'
      : 'Payment schedule: 50 percent at signing, 50 percent at completion.');
    s.para('This estimate is based on the information and photographs provided. Hidden conditions found once work begins are quoted separately as a Change Order before any additional work proceeds.');

    s.footer();
    return d;
  }

  function buildReceipt(v, img) {
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var s = new Sheet(d, img, v.co);
    var m = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    s.head('PAYMENT RECEIPT', v.number,
      [['Payment received', v.received_on], ['Date issued', v.issued_on]],
      'Proof of payment received.');

    s.font(10.5, true).d.text('PAYMENT RECEIVED, THANK YOU', M, s.y); s.y += 14;
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
    s.pairs([[['Issued by, printed name', v.issued_by], ['Date Issued', v.issued_on]]]);

    s.y += 8;
    s.para('This receipt confirms payment only. It does not waive any right or obligation under the signed Services Agreement, including any Change Order, remaining balance, or Stop-Work provision. Payments received are held in trust under Article 3-A of the New York Lien Law, as stated in the Agreement.', 8.5, false, GREY);

    s.y += 6; s.rule(); s.y += 12;
    s.font(8.5, false, GREY).d.text(
      'Thank you for choosing Proven Solutions  •  Proven solutions for you. No surprises.',
      W / 2, s.y, { align: 'center' });

    s.footer();
    return d;
  }


  /* ================= DOCUMENTOS ARMADOS DESDE PLANTILLA =================
     El contrato y el change order se pintan desde los bloques guardados en
     la base. Nelly no redacta: rellena y marca casillas. */

  /* Devuelve el valor de una etiqueta del formulario, o null si esa celda
     no es una etiqueta conocida. */
  function etiqueta(celda, v) {
    var vals = v.labels || {}, k = nmz(celda), hit = null;
    Object.keys(vals).forEach(function (lab) { if (hit === null && nmz(lab) === k) hit = vals[lab]; });
    return hit;
  }

  function nmz(s) {
    return String(s || '').replace(/☐|☑|☒/g, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /* Un recuadro de aviso, de los que el contrato trae en medio. */
  Sheet.prototype.callout = function (txt) {
    var sz = 8.5;
    this.font(sz, false, NAVY);
    var lines = this.d.splitTextToSize(txt, CW - 28);
    var hgt = lines.length * (sz + 2.5) + 20;
    this.room(hgt + 8);
    this.d.setFillColor(246, 244, 238);
    this.d.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    this.d.setLineWidth(1.2);
    this.d.rect(M, this.y - 8, CW, hgt, 'F');
    this.d.line(M, this.y - 8, M, this.y - 8 + hgt);
    this.font(sz, false, NAVY).d.text(lines, M + 14, this.y + 6);
    this.y += hgt + 6;
    return this;
  };

  /* Una casilla del contrato: cuadro dibujado, marcado si corresponde. */
  Sheet.prototype.box = function (x, label, on, w) {
    var sz = 8.5;
    this.d.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    this.d.setLineWidth(0.8);
    this.d.rect(x, this.y - 7, 8, 8);
    if (on) {
      this.d.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      this.d.rect(x + 2, this.y - 5, 4, 4, 'F');
    }
    this.font(sz, on).d.text(this.d.splitTextToSize(label, w - 16), x + 14, this.y);
    return this;
  };

  /* Una tabla genérica de la plantilla. */
  Sheet.prototype.tpl_table = function (rows, v) {
    var self = this;
    if (!rows.length) return this;

    /* Una sola columna en todas las filas: es un aviso, no una tabla. */
    var unaCol = rows.every(function (r) { return r.length === 1; });
    if (unaCol) {
      return this.callout(rows.map(function (r) { return r[0]; }).join('\n'));
    }

    var cols = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    var cw = CW / cols;
    rows.forEach(function (r, ri) {
      var esCasilla = r.some(function (c) { return String(c).indexOf('☐') === 0; });
      var alto = 0, partes = r.map(function (c) {
        self.font(8.5, ri === 0 && !esCasilla);
        var lines = self.d.splitTextToSize(String(c || ''), cw - 18);
        var h2 = lines.length * 11 + 10;
        if (etiqueta(c, v) !== null && String(c).indexOf('[') < 0) h2 = Math.max(h2, 30);
        alto = Math.max(alto, h2);
        return lines;
      });
      self.room(alto + 4);
      if (ri === 0 && !esCasilla) {
        self.d.setFillColor(248, 247, 243);
        self.d.rect(M, self.y - 9, CW, alto, 'F');
      }
      partes.forEach(function (lines, ci) {
        var x = M + cw * ci, crudo = String(r[ci] || '');
        if (crudo.indexOf('☐') === 0) {
          var label = crudo.replace(/^☐\s*/, '');
          var on = (v.checked || []).some(function (k) {
            return nmz(label).indexOf(nmz(k)) === 0;
          });
          self.box(x, label, on, cw);
        } else if (etiqueta(crudo, v) !== null && crudo.indexOf('[') < 0) {
          /* Es una etiqueta del formulario: va chiquita arriba y el dato
             debajo, como en una factura. Si no, saldría la etiqueta sola. */
          self.font(7, true, GREY).d.text(String(crudo).toUpperCase(), x + 4, self.y);
          self.font(9.5, false, NAVY).d.text(
            self.d.splitTextToSize(String(etiqueta(crudo, v) || '\u2014'), cw - 18), x + 4, self.y + 12);
        } else {
          self.font(8.5, ri === 0).d.text(lines, x + 4, self.y);
        }
      });
      self.y += alto;
      self.d.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
      self.d.setLineWidth(0.4);
      self.d.line(M, self.y - 7, W - M, self.y - 7);
    });
    this.y += 8;
    return this;
  };

  /* ---------- rellenar ---------- */
  function mny(n) {
    return '$' + Number(n || 0).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fillText(txt, v) {
    var s2 = String(txt == null ? '' : txt);
    s2 = s2.replace(/\[ESTIMATE DATE\]/g, v.estimate_date || '________________');
    s2 = s2.replace(/\[ESTIMATE TITLE \/ ?# ?\]/g, v.estimate_title || '________________');
    s2 = s2.replace(/\[___\]/g, v.number || '____');
    if (v.amount != null) s2 = s2.replace(/\$\[AMOUNT\]/g, mny(v.amount));
    return s2.replace(/\$\[AMOUNT\]/g, '$________');
  }

  /* Las filas con etiqueta conocida se llenan por el nombre de la etiqueta,
     no por su posición: si mañana se mueve una fila, sigue funcionando. */
  function fillRows(rows, v) {
    var vals = v.labels || {}, items = v.items || [];
    var out = [], puestos = false;
    rows.forEach(function (r) {
      var primero = String(r[0] || '');
      if (/^\[ITEM \d/.test(primero)) {
        if (puestos) return;
        puestos = true;
        items.forEach(function (it) {
          out.push([it.desc, it.qty == null ? '' : String(it.qty),
            it.unit == null ? '' : mny(it.unit), mny(it.total)]);
        });
        return;
      }
      /* Solo se reemplaza la última celda cuando esa celda es un hueco
         ($[AMOUNT], [___]). Si la fila es etiqueta + etiqueta, se deja
         como está y cada celda se llena por su cuenta más adelante. */
      var ultima = String(r[r.length - 1] || '');
      var esHueco = /\[[^\]]*\]|_{3,}/.test(ultima);
      var k = nmz(primero), hit = null;
      if (esHueco) Object.keys(vals).forEach(function (lab) {
        if (hit === null && k === nmz(lab)) hit = vals[lab];
      });
      if (hit !== null) {
        var copia = r.slice();
        copia[copia.length - 1] = typeof hit === 'number' ? mny(hit) : String(hit);
        out.push(copia.map(function (c, i) {
          return i === copia.length - 1 ? c : fillText(c, v);
        }));
      } else {
        out.push(r.map(function (c) { return fillText(c, v); }));
      }
    });
    return out;
  }

  function secNum(txt) {
    var m2 = String(txt).match(/^(\d+(?:\.\d+)?)/);
    return m2 ? m2[1] : null;
  }

  /** Arma el PDF desde los bloques de la plantilla. */
  function buildFromTemplate(v, img, blocks) {
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var s = new Sheet(d, img, v.co);
    s.head(v.title, v.number, v.rows || [], v.sub);

    var anular = v.blank || {};      // { '4.2': 'Not applicable to this Agreement.' }
    var saltando = null;

    var saltarTexto = [nmz(v.title), nmz(v.sub)];
    blocks.forEach(function (b) {
      /* El título y el subtítulo ya salen arriba: repetirlos sobra. */
      if (b.x && saltarTexto.indexOf(nmz(b.x)) >= 0) return;
      if (b.t === 'h1' || b.t === 'h2') {
        var n = secNum(b.x);
        if (saltando) {
          var sigue = n && (n === saltando || n.indexOf(saltando + '.') === 0);
          if (sigue) return;
          saltando = null;
        }
        s.y += b.t === 'h1' ? 10 : 6;
        s.room(40);
        s.font(b.t === 'h1' ? 11 : 9.5, true).d.text(fillText(b.x, v), M, s.y);
        s.y += b.t === 'h1' ? 5 : 4;
        if (b.t === 'h1') { s.rule(true); s.y += 10; } else { s.y += 6; }
        if (n && anular[n]) {
          s.para(anular[n], 9, false, GREY);
          saltando = n;
        }
        return;
      }
      if (saltando) return;
      if (b.t === 'p') s.para(fillText(b.x, v), 9);
      else if (b.t === 'tbl') s.tpl_table(fillRows(b.rows, v), v);
    });

    s.footer();
    return d;
  }


  /* ================= CONTRATO ================= */
  function plantilla(kind) {
    return q(sb.from('doc_templates').select('blocks').eq('kind', kind).maybeSingle())
      .then(function (r) {
        if (!r || !r.blocks) throw new Error('Falta la plantilla. ¿Corriste nelly-3-plantillas.sql?');
        return r.blocks;
      });
  }

  function contractFlow(main, ctx) {
    show(function () { pickProject(main, ctx, 'Contrato', function (pr) {
      fill(main, h('div', { class: 'spin' }));
      Promise.all([D.payments(pr.id), plantilla('contract')]).then(function (r) {
        var pays = r[0] || [], tpl = r[1];
        show(function () { contractForm(main, ctx, pr, pays, tpl); });
      }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
    }); });
  }

  function contractForm(main, ctx, pr, pays, tpl) {
    var tipo = h('select', null, [h('option', { value: 'Residential' }, 'Residencial'),
      h('option', { value: 'Commercial' }, 'Comercial')]);
    var serv = h('select', null, [h('option', { value: 'One-Time Project' }, 'Proyecto único'),
      h('option', { value: 'Subscription / Recurring' }, 'Suscripción / recurrente')]);
    var venc = h('select', null, ['1 Day', '3 Days', '1 Week', '2 Weeks'].map(function (x) {
      return h('option', { value: x }, x);
    }));
    venc.value = '1 Week';
    var ocup = h('select', null, [h('option', { value: 'VACANT' }, 'Vacío'),
      h('option', { value: 'OCCUPIED' }, 'Ocupado')]);
    var esGC = h('input', { type: 'checkbox' });
    var fecha = h('input', { type: 'date', value: pr.contract_date || P.dkey(new Date()) });
    var inicio = h('input', { type: 'date', value: pr.starts_on || '' });
    var fin = h('input', { type: 'date', value: pr.ends_on || '' });
    var estF = h('input', { type: 'date' });
    var estT = h('input', { placeholder: 'Firm Estimate #045 (Revised)' });
    var monto = h('input', { type: 'number', step: '0.01', value: pr.contract == null ? '' : pr.contract });

    var go = h('button', { class: 'btn', type: 'button' }, 'Revisar antes de generar');
    go.onclick = function () {
      if (!Number(monto.value)) { toast('Falta el valor del contrato.', true); monto.focus(); return; }
      var v = {
        tipo: tipo.value, serv: serv.value, venc: venc.value, ocup: ocup.value,
        gc: esGC.checked, fecha: fecha.value, inicio: inicio.value, fin: fin.value,
        est_fecha: estF.value, est_titulo: estT.value.trim(), monto: Number(monto.value)
      };
      show(function () { contractConfirm(main, ctx, pr, tpl, v); });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Contrato · ' + pr.name), backBtn()),
      robot('Marco las casillas y lleno los datos. El texto legal no se toca.', 'contrato'),
      missing(pr).length ? h('p', { class: 'mut sm warnline' },
        'Al proyecto le falta: ' + missing(pr).join(', ') + '.') : null,
      h('div', { class: 'card' },
        h('div', { class: 'two' }, field('Tipo de proyecto', tipo), field('Tipo de servicio', serv)),
        h('div', { class: 'two' }, field('Valor del contrato ($)', monto), field('Fecha del contrato', fecha)),
        h('div', { class: 'two' }, field('Inicio estimado', inicio), field('Entrega estimada', fin)),
        h('div', { class: 'two' }, field('Fecha del estimado', estF), field('Título del estimado', estT)),
        h('div', { class: 'two' }, field('Vencimiento de facturas', venc), field('El espacio está', ocup)),
        h('label', { class: 'fld row gap' }, esGC, h('span', null, 'El cliente es un general contractor')),
        h('p', { class: 'mut sm' }, 'Si no es suscripción, la sección 4.2 sale como "Not applicable". Lo mismo la 11 si el cliente no es GC.'),
        h('div', { class: 'acts' }, go)));
  }

  function contractConfirm(main, ctx, pr, tpl, v) {
    var blank = {};
    if (v.serv !== 'Subscription / Recurring') blank['4.2'] = 'Not applicable to this Agreement.';
    if (!v.gc) blank['11'] = 'Not applicable to this Agreement.';

    var fix = h('button', { class: 'btn ghost', type: 'button' }, 'Cambiar datos');
    fix.onclick = function () { if (stack.length > 1) history.back(); };
    var gen = h('button', { class: 'btn', type: 'button' }, 'Generar el PDF');
    gen.onclick = function () {
      run(gen, function () {
        var d = {
          co: ctx.co, title: 'SERVICES AGREEMENT',
          sub: 'Construction & Build-Out Services — State of New York',
          rows: [['Date of agreement', longDate(v.fecha)], ['Project', pr.name]],
          amount: v.monto,
          estimate_date: v.est_fecha ? longDate(v.est_fecha) : '',
          estimate_title: v.est_titulo,
          checked: [v.tipo, v.serv, v.venc, v.ocup],
          blank: blank,
          labels: {
            'CLIENT — Full Legal Name': pr.client_legal_name || pr.client,
            'Date of Agreement': longDate(v.fecha),
            'Client Address': pr.client_address,
            'Client Email': pr.client_email,
            'Client Phone': pr.client_phone,
            'Project Address (if different from above)': pr.address,
            'Project Start Date (estimated)': v.inicio ? longDate(v.inicio) : '',
            'Substantial Completion Date (estimated)': v.fin ? longDate(v.fin) : ''
          }
        };
        return ensure().then(logo).then(function (img) {
          return D.number('contract').then(function (num) {
            d.number = num;
            var doc = buildFromTemplate(d, img, tpl);
            return keep(pr, 'contract', num, doc).then(function (path) {
              doc.save('Proven-Contract-' + num + '.pdf');
              return D.save({ kind: 'contract', number: num, project_id: pr.id,
                status: 'issued', issued_on: P.dkey(new Date()), total: v.monto,
                body: d, pdf_path: path });
            });
          });
        }).then(function (row) {
          toast(row && row.pdf_path
            ? 'Contrato generado. El cliente ya lo puede firmar en su portal.'
            : 'Contrato generado, pero no se pudo guardar en el portal: el cliente no lo va a ver.');
          view(main);
        });
      });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar'), backBtn()),
      robot('Mira sobre todo las casillas y las secciones que van a salir anuladas.', 'contrato'),
      h('div', { class: 'card' },
        h('div', { class: 'list' }, [
          ['Proyecto', pr.name],
          ['Cliente', pr.client_legal_name || pr.client],
          ['Valor del contrato', money(v.monto)],
          ['Tipo', v.tipo + ' · ' + v.serv],
          ['Vencimiento de facturas', v.venc],
          ['El espacio está', v.ocup],
          ['Estimado que incorpora', (v.est_titulo || '—') + (v.est_fecha ? ' · ' + longDate(v.est_fecha) : '')],
          ['Secciones anuladas', Object.keys(blank).join(', ') || 'ninguna']
        ].map(function (r) {
          return h('div', { class: 'lrow slim' }, h('span', null, r[0]), h('b', null, r[1]));
        }))),
      h('div', { class: 'acts' }, fix, gen));
  }

  /* ================= ESTIMADO =================
     El estimado se le hace muchas veces a un lead, cuando todavía no hay
     proyecto. Por eso se puede hacer sin proyecto, escribiendo el cliente
     a mano, y las fotos no se guardan en ningún lado: van del navegador
     al estimador y ahí mueren. */

  var FORMATOS = [
    { k: 'A', t: 'A · Obra grande con opciones', d: 'Proyecto largo. Margen 30%.' },
    { k: 'B', t: 'B · Trabajo chico, labor y materiales', d: 'Margen 35%.' },
    { k: 'C', t: 'C · Solo labor', d: 'Margen 35%.' }
  ];

  /* Encoge la foto y la vuelve texto. El celular saca 4 MB y aquí no
     sirve de nada: lo que importa es lo que se ve, no el peso. */
  function leerFoto(file) {
    var pre = (window.API && window.API.shrink)
      ? window.API.shrink(file, 1400, 0.8) : Promise.resolve(file);
    return pre.then(function (f) {
      return new Promise(function (ok, no) {
        var r = new FileReader();
        r.onload = function () {
          var s = String(r.result || ''), i = s.indexOf(',');
          if (i < 0) return no(new Error('Esa foto no se pudo leer.'));
          ok({ media_type: f.type || 'image/jpeg', data: s.slice(i + 1), nombre: f.name });
        };
        r.onerror = function () { no(new Error('Esa foto no se pudo leer.')); };
        r.readAsDataURL(f);
      });
    });
  }

  function estimateFlow(main, ctx) {
    show(function () { estimateWho(main, ctx); });
  }

  /* ---------- 1. ¿para quién es? ----------
     Un estimado siempre sale para alguien que ya está registrado: un lead
     del CRM o un proyecto. Escribir el nombre a mano crearía un cliente
     que no existe en ninguna lista, y después nadie le hace seguimiento. */
  var ETAPAS = { new: 'Nuevo', contacted: 'Contactado', visit: 'Visita',
    quoted: 'Cotizado', won: 'Ganado', lost: 'Perdido' };

  function estimateWho(main, ctx) {
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Estimado'), backBtn()),
      h('div', { class: 'spin' }));

    D.leads().catch(function () { return null; }).then(function (leads) {
      var box = h('div', { class: 'list' });
      var find = h('input', { type: 'search', placeholder: 'Buscar por nombre, barrio o dirección…' });

      function draw() {
        var s2 = find.value.trim().toLowerCase();
        var hit = function (txt) { return !s2 || txt.toLowerCase().indexOf(s2) >= 0; };

        /* Los leads abiertos primero: son los que están esperando precio. */
        var abiertos = (leads || []).filter(function (l) {
          return ['new', 'contacted', 'visit', 'quoted'].indexOf(l.stage) >= 0
            && hit([l.name, l.borough, l.scope].join(' '));
        });
        var proys = ctx.projects.filter(function (p2) {
          return hit([p2.name, p2.client, p2.address].join(' '));
        });

        function fila(titulo, sub, derecha, onPick) {
          var el = h('button', { class: 'card lrow slim pick', type: 'button' },
            h('span', null, h('b', null, titulo), sub ? h('small', null, sub) : null),
            derecha);
          el.onclick = onPick;
          return el;
        }

        fill(box,
          leads === null
            ? h('p', { class: 'mut small' },
                'No puedo leer el CRM con este usuario, así que solo salen los proyectos.')
            : null,
          abiertos.length ? h('div', { class: 'sech' }, h('h3', null, 'Leads del CRM')) : null,
          abiertos.map(function (l) {
            return fila(l.name,
              [ETAPAS[l.stage] || l.stage, l.borough, l.scope].filter(Boolean).join(' · '),
              l.value != null ? h('b', null, money(l.value)) : P.chip(ETAPAS[l.stage] || l.stage, 'mut'),
              function () { show(function () { estimateForm(main, ctx, { lead: l }); }); });
          }),
          proys.length ? h('div', { class: 'sech' }, h('h3', null, 'Proyectos')) : null,
          proys.map(function (p2) {
            return fila(p2.name, [p2.client, p2.address].filter(Boolean).join(' · '),
              h('b', null, p2.contract != null ? money(p2.contract) : '-'),
              function () { show(function () { estimateForm(main, ctx, { pr: p2 }); }); });
          }),
          (!abiertos.length && !proys.length)
            ? h('p', { class: 'mut small' }, 'Nada coincide. Si el cliente es nuevo, regístralo primero en el CRM.')
            : null);
      }
      find.oninput = draw;
      draw();

      fill(main,
        h('div', { class: 'sech' }, h('h2', null, 'Estimado'), backBtn()),
        robot('¿Para quién es? Tiene que estar en el CRM o ser un proyecto.', 'saludo'),
        h('div', { class: 'mb' }, find),
        box);
    });
  }

  /* ---------- 2. lo que Nelly necesita saber ---------- */
  function estimateForm(main, ctx, dest, keep) {
    var st = keep || { formato: 'B', scope: '', zip: '', fotos: [] };
    var esLead = !dest.pr;

    var fmt = h('select', null, FORMATOS.map(function (f) {
      return h('option', { value: f.k }, f.t);
    }));
    fmt.value = st.formato;
    var fmtNota = h('p', { class: 'mut sm' });
    function notaFmt() {
      var f = FORMATOS.filter(function (x) { return x.k === fmt.value; })[0];
      fill(fmtNota, f ? f.d : '');
    }
    fmt.onchange = notaFmt; notaFmt();

    var L0 = dest.lead || {};
    var dir = h('input', { placeholder: 'Dirección de la obra',
      value: st.direccion != null ? st.direccion : (L0.borough || '') });

    var zip = h('input', { placeholder: '11375', inputmode: 'numeric', value: st.zip });
    /* El scope del lead ya viene escrito en el CRM: no hay por qué
       volverlo a escribir. */
    var scope = h('textarea', { rows: 6,
      placeholder: 'Qué pidió el cliente, qué viste en el walkthrough, medidas si las tienes. Escribe como le hablarías a Miguel.' },
      st.scope || [L0.scope, L0.notes].filter(Boolean).join('\n\n'));

    /* Las fotos ---------------------------------------------------- */
    var fotos = st.fotos.slice();
    var tira = h('div', { class: 'nelly-fotos' });
    var file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    var addF = h('button', { class: 'btn ghost sm', type: 'button' }, ico('plus', 15), 'Agregar fotos');
    addF.onclick = function () { file.click(); };
    function pintaFotos() {
      fill(tira, fotos.length ? fotos.map(function (f, i) {
        var x = h('button', { class: 'ib', type: 'button', 'aria-label': 'Quitar esta foto' }, '×');
        x.onclick = function () { fotos.splice(i, 1); pintaFotos(); };
        return h('div', { class: 'nelly-foto' },
          h('img', { src: 'data:' + f.media_type + ';base64,' + f.data, alt: f.nombre || '' }), x);
      }) : h('p', { class: 'mut sm' }, 'Sin fotos. Nelly puede trabajar solo con lo que escribas, pero con fotos acierta mucho más.'));
    }
    file.onchange = function () {
      var list = Array.prototype.slice.call(file.files || []).slice(0, 12 - fotos.length);
      if (!list.length) return;
      addF.disabled = true;
      Promise.all(list.map(leerFoto)).then(function (r) {
        fotos = fotos.concat(r); addF.disabled = false; file.value = ''; pintaFotos();
      }).catch(function (e) {
        addF.disabled = false; toast(P.errText(e), true);
      });
    };
    pintaFotos();

    var err = h('p', { class: 'err', role: 'alert' });
    var go = h('button', { class: 'btn', type: 'button' }, 'Que Nelly lo arme');
    go.onclick = function () {
      fill(err);
      if (!scope.value.trim() && !fotos.length) {
        fill(err, 'Escribe el scope o agrega al menos una foto.'); return;
      }
      var v = {
        formato: fmt.value, scope: scope.value.trim(), zip: zip.value.trim(),
        fotos: fotos, cliente: esLead ? L0.name : '', direccion: dir.value.trim()
      };
      run(go, function () { return pedirEstimado(main, ctx, dest, v); });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Estimado'), backBtn()),
      robot(esLead ? 'Estimado para ' + (L0.name || 'este lead') + '. ¿De qué se trata?'
        : 'Cuéntame qué hay que cotizar en ' + dest.pr.name + '.', 'estimado'),
      h('div', { class: 'card' },
        field('Formato', fmt), fmtNota,
        esLead ? field('Dirección', dir) : null,
        field('Zipcode', zip, 'Con esto Nelly busca el precio de mercado de la zona.'),
        field('El trabajo', scope)),
      h('div', { class: 'card' },
        h('div', { class: 'sech' }, h('h3', null, 'Fotos'), addF),
        tira, file),
      err,
      h('div', { class: 'acts' }, go));
  }

  /* ---------- 3. la llamada ---------- */
  function pedirEstimado(main, ctx, dest, v, ajuste) {
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Estimado')),
      robot(ajuste
        ? 'Lo estoy rehaciendo con lo que me dijiste.'
        : 'Estoy mirando las fotos, armando el scope y buscando precios de la zona. Esto se demora un poco.',
        'pensando'),
      h('div', { class: 'spin' }));

    var body = {
      formato: v.formato, scope: v.scope, zip: v.zip,
      imagenes: v.fotos.map(function (f) { return { media_type: f.media_type, data: f.data }; })
    };
    if (dest.pr) body.project_id = dest.pr.id;
    else body.lead = { cliente: v.cliente, direccion: v.direccion };
    if (ajuste) { body.previo = ajuste.previo; body.ajustes = ajuste.texto; }

    return sb.functions.invoke('estimate', { body: body }).then(function (r) {
      if (r.error) throw r.error;
      var res = r.data || {};
      if (res.error) throw new Error(res.error);
      show(function () { estimateReview(main, ctx, dest, v, res); });
    }).catch(function (e) {
      fill(main,
        h('div', { class: 'sech' }, h('h2', null, 'Estimado'), backBtn()),
        robot('No pude armarlo. ' + P.errText(e), 'ups'));
    });
  }

  /* ---------- 4. revisar antes de nada ---------- */
  var GRUPOS = [
    { k: 'labor',    t: 'Labor' },
    { k: 'material', t: 'Materiales' },
    { k: 'sub',      t: 'Subcontratado' },
    { k: 'otro',     t: 'Otros costos' }
  ];

  function estimateReview(main, ctx, dest, v, res) {
    var filas = (res.partidas || []).map(function (p) { return Object.assign({}, p); });
    var totBox = h('div', { class: 'list' });

    function recalc() {
      var por = {};
      GRUPOS.forEach(function (g) {
        por[g.k] = Math.round(filas.filter(function (f) { return f.grupo === g.k; })
          .reduce(function (a, f) { return a + (Number(f.precio) || 0); }, 0) * 100) / 100;
      });
      var total = Math.round(GRUPOS.reduce(function (a, g) { return a + por[g.k]; }, 0) * 100) / 100;
      var costo = Math.round(filas.reduce(function (a, f) { return a + (Number(f.costo) || 0); }, 0) * 100) / 100;
      var mr = total > 0 ? Math.round(((total - costo) / total) * 1000) / 10 : 0;
      res._tot = { por: por, total: total, costo: costo, margen: mr };

      fill(totBox,
        GRUPOS.filter(function (g) { return por[g.k] > 0; }).map(function (g) {
          return h('div', { class: 'lrow slim' }, h('span', null, g.t), h('b', null, money(por[g.k])));
        }).concat([
          h('div', { class: 'lrow slim tot' }, h('span', null, 'TOTAL'), h('b', null, money(total))),
          h('div', { class: 'lrow slim' },
            h('span', { class: 'mut' }, 'Te cuesta'), h('span', { class: 'mut' }, money(costo))),
          h('div', { class: 'lrow slim' },
            h('span', { class: 'mut' }, 'Margen real'),
            h('b', { class: mr < 15 ? 'bad' : mr < 20 ? 'warn' : 'ok' }, mr + '%'))
        ]));
    }

    var cuerpo = h('div');
    function tabla(g) {
      var mias = filas.filter(function (f) { return f.grupo === g.k; });
      if (!mias.length) return null;
      return h('div', { class: 'card' },
        h('h3', null, g.t),
        h('div', { class: 'list' }, mias.map(function (f) {
          var inp = h('input', { type: 'number', step: '0.01', value: String(f.precio == null ? 0 : f.precio) });
          inp.oninput = function () { f.precio = Number(inp.value) || 0; recalc(); };
          /* Quitar una partida de verdad: sale del estimado y de las
             cuentas. Si solo se pone en cero, el renglón igual se imprime
             y el cliente lee algo que no va a pasar. */
          var del = h('button', { class: 'ib', type: 'button',
            'aria-label': 'Quitar esta partida' }, '×');
          del.onclick = function () {
            var i = filas.indexOf(f);
            if (i >= 0) filas.splice(i, 1);
            pinta();
          };
          var det = [
            f.grupo === 'labor'
              ? ((f.dias || 0) + (f.dias === 1 ? ' día' : ' días') + ' · ' + (f.personas || 1) + (f.personas === 1 ? ' persona' : ' personas'))
              : ((f.cantidad || '') + ' ' + (f.unidad || '')).trim(),
            'te cuesta ' + money(f.costo || 0),
            'margen ' + (f.margen_pct || 0) + '%'
          ].filter(Boolean).join(' · ');
          return h('div', { class: 'card lrow slim' },
            h('span', null, h('b', null, f.desc || ''), h('small', null, det),
              f.nota ? h('small', { class: 'mut' }, f.nota) : null),
            h('span', { class: 'row gap' }, inp, del));
        })));
    }
    function pinta() { fill(cuerpo, GRUPOS.map(tabla)); recalc(); }

    function lista(title, arr, cls) {
      if (!arr || !arr.length) return null;
      return h('div', { class: 'card' + (cls ? ' ' + cls : '') },
        h('h3', null, title),
        h('ul', { class: 'bul' }, arr.map(function (x) { return h('li', null, x); })));
    }

    var mk = res.mercado || {};
    var mercado = (mk.bajo || mk.alto)
      ? h('div', { class: 'card' },
          h('h3', null, 'Lo que cobra el mercado en esa zona'),
          h('div', { class: 'lrow slim' },
            h('span', null, 'Rango encontrado'),
            h('b', null, money(mk.bajo) + ' a ' + money(mk.alto))),
          (mk.fuentes || []).length
            ? h('div', { class: 'list' }, mk.fuentes.slice(0, 6).map(function (u) {
                return h('a', { class: 'lnk', href: u, target: '_blank', rel: 'noopener noreferrer' }, u);
              }))
            : h('p', { class: 'mut sm' }, 'Sin fuentes. Toma el rango con pinzas.'))
      : null;

    var gen = h('button', { class: 'btn', type: 'button' }, 'Generar el PDF');
    gen.onclick = function () {
      run(gen, function () { return emitirEstimado(main, ctx, dest, v, res, filas); });
    };
    var volver = h('button', { class: 'btn ghost', type: 'button' }, 'Cambiar datos');
    volver.onclick = function () { if (stack.length > 1) history.back(); };

    /* Reformular: para cuando el problema no es un precio sino el scope.
       Quitar una partida se hace con la X; esto es para "sácame toda la
       cocina" o "el piso va en opción aparte". */
    var refo = h('button', { class: 'btn ghost', type: 'button' }, ico('edit', 15), 'Reformular');
    refo.onclick = function () {
      var txt = h('textarea', { rows: 4,
        placeholder: 'Qué hay que cambiar. Por ejemplo: quita toda la demolición del baño, el cliente la hace él. O: separa el piso como opción aparte.' });
      var ok = h('button', { class: 'btn', type: 'button' }, 'Que lo rehaga');
      var m2 = modal('Reformular el estimado', h('div', null,
        h('p', { class: 'mut sm' },
          'Lo que le digas que quite, lo quita, no lo vuelve a meter con otro nombre. Lo que no menciones queda igual.'),
        field('Qué cambiar', txt),
        h('div', { class: 'acts' }, ok)));
      ok.onclick = function () {
        var t2 = txt.value.trim();
        if (!t2) { txt.focus(); return; }
        m2.close();
        /* Se le manda lo que hay AHORA en pantalla, no lo que devolvió la
           primera vez: si ella ya borró partidas o cambió precios, eso
           cuenta. */
        var previo = {
          titulo: res.titulo, resumen: res.resumen,
          partidas: filas.map(function (f) {
            return { desc: f.desc, grupo: f.grupo, dias: f.dias, personas: f.personas,
              cantidad: f.cantidad, unidad: f.unidad, costo_unitario: f.costo_unitario };
          }),
          excluye: res.excluye
        };
        pedirEstimado(main, ctx, dest, v, { previo: previo, texto: t2 });
      };
      setTimeout(function () { txt.focus(); }, 60);
    };

    pinta();
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, res.titulo || 'Estimado'), backBtn()),
      robot('Revisa antes de que esto salga. El número final es tuyo, no mío.', 'pensando'),
      res.resumen ? h('div', { class: 'card' }, h('p', null, res.resumen)) : null,
      lista('Ojo con esto', res.avisos, 'warnbox'),
      lista('Falta definir', res.preguntas),
      cuerpo,
      h('div', { class: 'card' }, h('h3', null, 'Totales'), totBox),
      mercado,
      lista('Lo que NO incluye', res.excluye),
      h('div', { class: 'acts' }, volver, refo, gen));
  }

  /* ---------- 5. el PDF ---------- */
  function emitirEstimado(main, ctx, dest, v, res, filas) {
    var hoy = P.dkey(new Date());
    return ensure().then(logo).then(function (img) {
      return D.number('estimate').then(function (num) {
        var d = {
          co: ctx.co, number: num, fecha: hoy,
          titulo: res.titulo || 'Project Estimate',
          resumen: res.resumen || '',
          bill: {
            name: dest.pr ? (dest.pr.client_legal_name || dest.pr.client) : v.cliente,
            address: dest.pr ? dest.pr.address : v.direccion
          },
          formato: v.formato,
          validez: res.validez_dias || 15,
          filas: filas, totales: res._tot,
          excluye: res.excluye || []
        };
        var doc = buildEstimate(d, img);
        var pr = dest.pr;
        var guardar = pr
          ? keep(pr, 'estimate', num, doc)
          : Promise.resolve(null);
        return guardar.then(function (path) {
          doc.save('Proven-Estimate-' + num + '.pdf');
          return D.save({
            kind: 'estimate', number: num, project_id: pr ? pr.id : null,
            status: 'issued', issued_on: hoy,
            total: (res._tot && res._tot.total) || 0, body: d, pdf_path: path
          });
        });
      });
    }).then(function (row) {
      /* El CRM se entera solo. Si no, mañana alguien llama a este cliente
         a preguntarle si ya le pasamos precio. */
      if (!dest.lead || !dest.lead.id) return row;
      return D.quoted(dest.lead.id, (res._tot && res._tot.total) || 0,
        'Estimado ' + row.number + ' enviado el ' + hoy)
        .then(function () { return row; })
        .catch(function () { return row; });
    }).then(function () {
      toast(dest.lead ? 'Estimado generado. El lead quedó en Cotizado.' : 'Estimado generado.');
      view(main);
    });
  }

  /* ================= CHANGE ORDER ================= */
  var CO_RAZON = ['Client Request', 'Hidden Condition', 'Building Requirement', 'Other'];

  function coFlow(main, ctx) {
    show(function () { pickProject(main, ctx, 'Change order', function (pr) {
      fill(main, h('div', { class: 'spin' }));
      Promise.all([D.summary(pr.id), plantilla('change_order')]).then(function (r) {
        var sum = (r[0] || [])[0] || {}, tpl = r[1];
        show(function () { coForm(main, ctx, pr, sum, tpl); });
      }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
    }); });
  }

  function coForm(main, ctx, pr, sum, tpl) {
    var razon = h('select', null, CO_RAZON.map(function (x) { return h('option', { value: x }, x); }));
    var desc = h('textarea', { rows: 3, placeholder: 'Qué cambia y por qué' });
    var dias = h('input', { type: 'number', min: '0', value: '0' });
    var rowsBox = h('div', { class: 'list' });
    function itemRow(it) {
      var d1 = h('input', { value: (it && it.desc) || '', placeholder: 'Qué se agrega' });
      var q1 = h('input', { type: 'number', step: '0.01', value: 1 });
      var u1 = h('input', { type: 'number', step: '0.01', placeholder: '0.00' });
      var del = h('button', { class: 'ib', type: 'button', 'aria-label': 'Quitar' }, '×');
      var el = h('div', { class: 'card lrow slim nelly-item' }, d1, q1, u1, del);
      el._read = function () {
        var qn = Number(q1.value) || 0, un = Number(u1.value) || 0;
        return { desc: d1.value.trim(), qty: qn, unit: un, total: Math.round(qn * un * 100) / 100 };
      };
      del.onclick = function () { el.remove(); };
      return el;
    }
    rowsBox.append(itemRow());
    var add = h('button', { class: 'btn ghost sm', type: 'button' }, ico('plus', 15), 'Otro renglón');
    add.onclick = function () { rowsBox.append(itemRow()); };

    var go = h('button', { class: 'btn', type: 'button' }, 'Revisar antes de generar');
    go.onclick = function () {
      var items = Array.prototype.map.call(rowsBox.children, function (el) { return el._read(); })
        .filter(function (i) { return i.desc || i.total; });
      if (!items.length) { toast('Falta al menos un renglón.', true); return; }
      if (!desc.value.trim()) { toast('Falta decir qué cambia.', true); desc.focus(); return; }
      var tot = items.reduce(function (a, i) { return a + i.total; }, 0);
      show(function () {
        coConfirm(main, ctx, pr, sum, tpl, {
          razon: razon.value, desc: desc.value.trim(), dias: Number(dias.value) || 0,
          items: items, total: Math.round(tot * 100) / 100
        });
      });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Change order · ' + pr.name), backBtn()),
      robot('Los change orders no llevan descuento. Eso lo dice tu propio contrato.', 'change'),
      summaryCard(sum),
      h('div', { class: 'card' },
        h('div', { class: 'two' }, field('Razón del cambio', razon), field('Días adicionales de obra', dias)),
        field('Qué cambia', desc),
        h('div', { class: 'sech' }, h('h3', null, 'Costo'), add),
        rowsBox,
        h('div', { class: 'acts' }, go)));
  }

  function coConfirm(main, ctx, pr, sum, tpl, v) {
    var orig = Number(sum.contract_original) || 0;
    var previos = Number(sum.change_orders) || 0;
    var nuevo = Math.round((orig + previos + v.total) * 100) / 100;
    var mitad = Math.round((v.total / 2) * 100) / 100;

    var fix = h('button', { class: 'btn ghost', type: 'button' }, 'Cambiar datos');
    fix.onclick = function () { if (stack.length > 1) history.back(); };
    var gen = h('button', { class: 'btn', type: 'button' }, 'Generar el PDF');
    gen.onclick = function () {
      run(gen, function () {
        var d = {
          co: ctx.co, title: 'CHANGE ORDER',
          rows: [['Date', longDate(P.dkey(new Date()))], ['Project', pr.name]],
          checked: [v.razon], items: v.items, amount: v.total,
          labels: {
            'CHANGE ORDER TOTAL': v.total,
            'Original Contract Amount': orig,
            'Prior approved Change Orders (running total)': previos,
            'This Change Order': v.total,
            'NEW CONTRACT TOTAL  (after this CO)': nuevo,
            'NEW CONTRACT TOTAL (after this CO)': nuevo,
            '50% Due at Signing': mitad,
            '50% Added to Final Balance': mitad,
            'Additional Working Days Required': String(v.dias),
            'CLIENT — Full Legal Name': pr.client_legal_name || pr.client,
            'Project Address': pr.address,
            'Original Contract Date': longDate(pr.contract_date)
          },
          reason: v.desc
        };
        return ensure().then(logo).then(function (img) {
          return D.number('change_order').then(function (num) {
            d.number = num;
            var doc = buildFromTemplate(d, img, tpl);
            return keep(pr, 'change_order', num, doc).then(function (path) {
              doc.save('Proven-ChangeOrder-' + num + '.pdf');
              return D.save({ kind: 'change_order', number: num, project_id: pr.id,
                status: 'issued', issued_on: P.dkey(new Date()), total: v.total,
                body: d, pdf_path: path });
            });
          });
        }).then(function (row) {
          toast(row && row.pdf_path
            ? 'Change order generado. El cliente ya lo puede firmar en su portal.'
            : 'Change order generado, pero no se pudo guardar en el portal: el cliente no lo va a ver.');
          view(main);
        });
      });
    };

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar'), backBtn()),
      robot('Esto cambia el valor del contrato. Revisa el total nuevo.', 'change'),
      h('div', { class: 'card' },
        h('div', { class: 'list' }, v.items.map(function (i) {
          return h('div', { class: 'lrow slim' },
            h('span', null, h('b', null, i.desc), h('small', null, i.qty + ' × ' + money(i.unit))),
            h('b', null, money(i.total)));
        })),
        h('div', { class: 'lrow slim tot' }, h('span', null, 'ESTE CHANGE ORDER'), h('b', null, money(v.total)))),
      h('div', { class: 'card' },
        h('div', { class: 'list' }, [
          ['Contrato original', money(orig)],
          ['Change orders previos', money(previos)],
          ['Este change order', money(v.total)],
          ['Días adicionales', String(v.dias)]
        ].map(function (r) {
          return h('div', { class: 'lrow slim' }, h('span', null, r[0]), h('b', null, r[1]));
        })),
        h('div', { class: 'lrow slim tot' }, h('span', null, 'CONTRATO NUEVO'), h('b', null, money(nuevo))),
        h('p', { class: 'mut sm' }, '50% a la firma: ' + money(mitad) + ' · 50% al saldo final: ' + money(mitad))),
      h('div', { class: 'acts' }, fix, gen));
  }

  /* ---------- lo que el resto del portal puede llamar ---------- */
  window.NELLY = {
    ensure: ensure,
    logo: logo,
    buildInvoice: buildInvoice,
    buildReceipt: buildReceipt,
    buildEstimate: buildEstimate,
    buildFromTemplate: buildFromTemplate,
    FOR_OPTS: FOR_OPTS,
    METHODS: METHODS,
    view: view
  };

  /* ================= LA PANTALLA ================= */
  var P;   /* window.PS: los ayudantes del portal */
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
    },
    leads: function () {
      return q(sb.from('funnel_leads').select('*').order('updated_at', { ascending: false }).limit(500));
    },
    /* Cuando sale el estimado, el lead pasa a "cotizado" con su valor. Si
       no, el CRM queda diciendo que ese cliente sigue esperando precio. */
    quoted: function (id, valor, nota) {
      return q(sb.from('funnel_leads').update({
        stage: 'quoted', value: valor, next_step: nota
      }).eq('id', id));
    }
  };

  /* Deja el PDF guardado en el portal y devuelve dónde quedó.
     Es lo que después le permite al cliente leerlo y firmarlo.
     Si la subida falla, el documento igual se guarda: el PDF ya quedó
     bajado en el computador de quien lo generó. */
  function keep(pr, kind, num, doc) {
    var path = pr.id + '/docs/' + kind + '-' +
      String(num).replace(/[^A-Za-z0-9_.-]/g, '') + '.pdf';
    var blob;
    try { blob = doc.output('blob'); } catch (e) { return Promise.resolve(null); }
    return Promise.resolve(
      sb.storage.from('project-files')
        .upload(path, blob, { contentType: 'application/pdf' })
    ).then(function (r) { return r && r.error ? null : path; })
      .catch(function () { return null; });
  }

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


  /* ---------- pasos: el botón de atrás del navegador se queda dentro ---------- */
  var stack = [], wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    window.addEventListener('popstate', function () {
      if (!P || !P.S || P.S.tab !== 'nelly' || stack.length < 2) return;
      stack.pop();
      stack[stack.length - 1]();
    });
  }
  /* Entra a una pantalla nueva y la deja anotada, para poder devolverse. */
  function show(render) {
    wire();
    stack.push(render);
    if (stack.length > 1) { try { history.pushState({ nelly: stack.length }, ''); } catch (e) { /* ok */ } }
    render();
  }
  function backBtn() {
    var b = h('button', { class: 'lnk', type: 'button' }, '← Volver');
    b.onclick = function () {
      if (stack.length > 1) history.back();
    };
    b.hidden = stack.length < 2;
    return b;
  }

  /* ---------- el saludo y las opciones ---------- */
  var MENU = [
    { k: 'estimate', t: 'Hacer un estimado', d: 'Lee las fotos y arma el PDF.' },
    { k: 'estimate_edit', t: 'Modificar un estimado', d: 'Busca uno y lo abre para cambiarlo.', soon: true },
    { k: 'contract', t: 'Hacer el contrato', d: 'Saca los datos del proyecto.' },
    { k: 'change_order', t: 'Hacer un change order', d: 'Cuelga del contrato.' },
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
        stack = [];
        show(function () { home(main, ctx); });
      })
      .catch(function (e) {
        fill(main, empty('Nelly', P.errText(e) + ' — ¿ya corriste nelly-1-documentos.sql?'));
      });
  }

  /* Nelly, en la pose que corresponda a lo que se está haciendo. Antes
     todas las pantallas repetían "¿Qué vamos a hacer hoy?" aunque ya
     estuvieras a medio camino, que se leía raro. Ahora el saludo es solo
     del inicio. */
  function robot(line, pose) {
    return h('div', { class: 'nelly-hi' },
      h('img', { class: 'bot', src: 'nelly/' + (pose || 'saludo') + '.webp',
        alt: 'Nelly', width: '72', height: '72', loading: 'lazy' }),
      h('div', null, line
        ? h('p', null, line)
        : [h('b', null, '¿Qué vamos a hacer hoy?'),
           h('p', { class: 'mut sm' }, 'Escoge una y yo pregunto solo lo que falte.')]));
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
          if (m.k === 'estimate') estimateFlow(main, ctx);
          else if (m.k === 'invoice') invoiceFlow(main, ctx);
          else if (m.k === 'receipt') receiptFlow(main, ctx);
          else if (m.k === 'contract') contractFlow(main, ctx);
          else if (m.k === 'change_order') coFlow(main, ctx);
        };
      }
      return el;
    });

    var recent = ctx.recent.length
      ? h('div', { class: 'list' }, ctx.recent.map(function (d) {
          var pr = ctx.projects.filter(function (x) { return x.id === d.project_id; })[0];
          /* Un contrato sin firmar no es un trámite pendiente: es plata que
             todavía no está asegurada. Por eso se marca. */
          var falta = FIRMABLES[d.kind] && d.status === 'issued';
          var abrir = h('button', { class: 'lnk', type: 'button' }, 'Abrir el PDF');
          abrir.onclick = function () { openPdf(d, abrir); };
          return h('div', { class: 'card lrow slim' },
            h('span', null,
              h('b', null, KIND[d.kind] + ' #' + d.number),
              h('small', null, [pr ? pr.name : '', d.issued_on ? longDate(d.issued_on) : '',
                d.total != null ? money(d.total) : '',
                d.signed_at ? 'firmado por ' + d.signed_name : ''].filter(Boolean).join(' · ')),
              d.pdf_path ? abrir : null),
            P.chip(falta ? 'Falta la firma' : (ST[d.status] || d.status),
              d.status === 'void' ? 'bad' : falta ? 'warn' : 'ok'));
        }))
      : h('p', { class: 'mut small' }, 'Todavía no hay documentos.');

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Nelly')),
      robot(),
      h('div', { class: 'nelly-grid' }, cards),
      h('div', { class: 'sech' }, h('h3', null, 'Últimos documentos')),
      recent);
  }

  var FIRMABLES = { contract: 1, change_order: 1 };

  /* Abre el PDF guardado. El enlace dura una hora y se pide en el momento:
     nunca queda una dirección pública del contrato dando vueltas. */
  function openPdf(d, btn) {
    if (!d.pdf_path) { toast('Ese documento no quedó guardado en el portal.'); return; }
    run(btn, function () {
      return Promise.resolve(
        sb.storage.from('project-files').createSignedUrl(d.pdf_path, 3600)
      ).then(function (r) {
        if (!r || r.error || !r.data || !r.data.signedUrl) throw (r && r.error) || new Error('No se pudo abrir.');
        window.open(r.data.signedUrl, '_blank', 'noopener');
      });
    });
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
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, title), backBtn()),
      robot('¿Para qué proyecto?', 'saludo'),
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
        return keep(pr, kind, num, doc).then(function (path) {
          doc.save('Proven-' + (kind === 'invoice' ? 'Invoice' : 'Receipt') + '-' + num + '.pdf');
          var row = {
            kind: kind, number: num, project_id: pr.id, status: 'issued',
            issued_on: P.dkey(new Date()), total: v.total || v.amount || 0,
            body: v, pdf_path: path
          };
          if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
          return D.save(row);
        });
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
    show(function () { pickProject(main, ctx, 'Invoice', function (pr) {
      fill(main, h('div', { class: 'spin' }));
      Promise.all([D.payments(pr.id), D.summary(pr.id)]).then(function (r) {
        var pays = r[0] || [], sum = (r[1] || [])[0] || {};
        show(function () { invoiceForm(main, ctx, pr, pays, sum); });
      }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
    }); });
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
      var v = {
        for: forSel.value, date: fdate.value, due: fdue.value,
        items: items, subtotal: Math.round(sub * 100) / 100, tax: tax,
        total: Math.round((sub + tax) * 100) / 100,
        notes: fnotes.value.trim(), payment_id: sel.value || null, reason: st.reason
      };
      show(function () { invoiceConfirm(main, ctx, pr, pays, sum, v); });
    };
    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Invoice · ' + pr.name), backBtn()),
      faltan.length ? h('p', { class: 'mut sm warnline' },
        'Al proyecto le falta: ' + faltan.join(', ') + '. El documento sale igual, pero esos campos van vacíos.') : null,
      robot('Escoge qué se cobra. Lo demás lo traigo yo.', 'invoice'),
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
    fix.onclick = function () { if (stack.length > 1) history.back(); };

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
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar'), backBtn()),
      robot('Una vez lo genere, el documento no se edita. Si algo está mal, cámbialo ahora.', 'invoice'),
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
    show(function () { pickProject(main, ctx, 'Receipt', function (pr) { show(function () {
      var si = h('button', { class: 'btn big', type: 'button' }, 'Sí, ya pagó');
      var no = h('button', { class: 'btn ghost big', type: 'button' }, 'Todavía no');
      no.onclick = function () {
        toast('Entonces no va recibo. El recibo es la constancia de que el dinero ya entró.', true);
        home(main, ctx);
      };
      si.onclick = function () {
        fill(main, h('div', { class: 'spin' }));
        Promise.all([D.payments(pr.id), D.summary(pr.id)]).then(function (r) {
          var pays = r[0] || [], sum = (r[1] || [])[0] || {};
          show(function () { receiptForm(main, ctx, pr, pays, sum); });
        }).catch(function (e) { fill(main, empty('Nelly', P.errText(e))); });
      };
      fill(main,
        h('div', { class: 'sech' }, h('h2', null, 'Receipt · ' + pr.name), backBtn()),
        h('div', { class: 'card nelly-ask' },
          h('h3', null, '¿El cliente ya hizo el pago?'),
          h('p', { class: 'mut sm' }, 'Un recibo se emite después de que el dinero entró, nunca antes.'),
          h('div', { class: 'acts' }, si, no)));
    }); }); });
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
      var v = {
        payment_id: sel.value || null, amount: amt, received_on: when.value,
        method: method.value, check_number: check.value.trim(), reference: ref.value.trim(),
        applied_to: applied.value, invoice_number: invno.value.trim(),
        issued_by: issued.value.trim(), file: shot.files && shot.files[0]
      };
      show(function () { receiptConfirm(main, ctx, pr, pays, sum, v); });
    };
    var chk = field('Número del cheque', check);
    chk.hidden = true;

    fill(main,
      h('div', { class: 'sech' }, h('h2', null, 'Receipt · ' + pr.name), backBtn()),
      robot('Dime cómo entró la plata y con qué número de confirmación.', 'receipt'),
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
    fix.onclick = function () { if (stack.length > 1) history.back(); };

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
      h('div', { class: 'sech' }, h('h2', null, 'Revisa antes de generar'), backBtn()),
      robot('Una vez emitido, el recibo no se edita. Si algo está mal, cámbialo ahora.', 'receipt'),
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
