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
    view: function (main) {
      P = window.PS;
      P.fill(main, P.empty('Nelly', 'La pantalla se arma en el siguiente paso.'));
    }
  };
})();
