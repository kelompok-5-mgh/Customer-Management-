/* Relasi – halaman laporan */
(function (global) {
  'use strict';

  const UI = global.RelasiUI;
  const Views = global.RelasiViews;
  const H = Views.helpers;
  const h = UI.h;
  const icon = UI.icon;

  const DAY = 86400000;
  const IDLE_DAYS = 30;

  const PERIODS = [
    { days: 30, label: '30 hari terakhir' },
    { days: 90, label: '90 hari terakhir' },
    { days: 365, label: '12 bulan terakhir' }
  ];

  /* ---------- Komponen grafik ---------- */

  function monthlyBuckets(items, getTime) {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: d.getFullYear() + '-' + d.getMonth(), label: UI.formatMonth(d), count: 0 });
    }
    items.forEach(function (item) {
      const d = new Date(getTime(item));
      const key = d.getFullYear() + '-' + d.getMonth();
      const bucket = buckets.find(function (b) { return b.key === key; });
      if (bucket) bucket.count++;
    });
    return buckets;
  }

  function barChart(buckets, title) {
    const max = Math.max.apply(null, buckets.map(function (b) { return b.count; }).concat(1));
    const summary = buckets.map(function (b) { return b.label + ' ' + b.count; }).join(', ');

    return h('div', { class: 'bars', role: 'img', 'aria-label': title + ': ' + summary },
      buckets.map(function (b) {
        const height = b.count ? Math.max(8, Math.round((b.count / max) * 100)) : 3;
        return h('div', { class: 'bar-col' },
          h('span', { class: 'bar-value', text: String(b.count) }),
          h('span', { class: 'bar' + (b.count ? '' : ' is-zero'), style: 'height:' + height + '%' }),
          h('span', { class: 'bar-label', text: b.label })
        );
      })
    );
  }

  function hbars(items, emptyText) {
    if (!items.length) return h('p', { class: 'muted-text', text: emptyText });
    const max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat(1));

    return h('ul', { class: 'hbars' }, items.map(function (item) {
      const width = item.value ? Math.max(3, Math.round((item.value / max) * 100)) : 0;
      return h('li', {},
        h('span', { class: 'hbar-label', text: item.label }),
        h('span', { class: 'hbar-track', 'aria-hidden': 'true' },
          h('span', { class: 'hbar-fill ' + (item.cls || ''), style: 'width:' + width + '%' })
        ),
        h('span', { class: 'hbar-value', text: String(item.value) })
      );
    }));
  }

  function countBy(list, getKey) {
    const counts = {};
    list.forEach(function (item) {
      const key = getKey(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  /* ---------- Halaman ---------- */

  function renderReports(root, app) {
    Views.setApp(app);

    const days = app.reportDays || 30;
    const period = PERIODS.find(function (p) { return p.days === days; }) || PERIODS[0];
    const customers = app.customers;

    const periodSelect = h('select', { id: 'report-period', 'aria-label': 'Periode laporan' },
      PERIODS.map(function (p) { return h('option', { value: String(p.days), text: p.label }); })
    );
    periodSelect.value = String(period.days);
    periodSelect.addEventListener('change', function () {
      app.reportDays = Number(periodSelect.value);
      app.renderView();
    });

    root.append(
      h('div', { class: 'report-head' },
        h('p', { class: 'page-intro', text: 'Ringkasan pelanggan dan interaksi. Angka periode mengikuti pilihan di kanan.' }),
        h('div', { class: 'report-actions' },
          periodSelect,
          h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onclick: function () { global.RelasiExport.run(app); } }, icon('download', 18), 'Ekspor Excel'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onclick: function () { window.print(); } }, icon('print', 18), 'Cetak')
        )
      )
    );

    if (!customers.length) {
      root.append(h('section', { class: 'card' }, H.emptyState(
        'Belum ada data untuk dilaporkan',
        'Laporan terisi setelah Anda menambahkan pelanggan dan mencatat interaksi.',
        [{ label: 'Lihat pelanggan', primary: true, onclick: function () { app.navigate('pelanggan'); } }]
      )));
      return;
    }

    const since = Date.now() - period.days * DAY;
    const inPeriod = app.interactions.filter(function (i) { return i.at >= since; });
    const newCustomers = customers.filter(function (c) { return c.createdAt >= since; }).length;
    const contacted = Object.keys(countBy(inPeriod, function (i) { return i.customerId; })).length;
    const followDone = app.activities.filter(function (a) { return a.type === 'followup_done' && a.createdAt >= since; }).length;

    root.append(
      h('div', { class: 'stats' },
        H.statCard({ icon: 'users', label: 'Pelanggan baru', value: newCustomers }),
        H.statCard({ icon: 'message', label: 'Interaksi dicatat', value: inPeriod.length, tone: 'tone-ok' }),
        H.statCard({ icon: 'phone', label: 'Pelanggan dihubungi', value: contacted, tone: 'tone-info' }),
        H.statCard({ icon: 'check', label: 'Tindak lanjut selesai', value: followDone, tone: 'tone-ok' })
      )
    );

    // Interaksi per bulan dan menurut jenis
    const typeCounts = countBy(inPeriod, function (i) { return i.type; });
    const typeItems = Object.keys(UI.INTERACTION).map(function (key) {
      return { label: UI.INTERACTION[key].label, value: typeCounts[key] || 0 };
    }).sort(function (a, b) { return b.value - a.value; });

    root.append(
      h('div', { class: 'grid-2' },
        H.card('Interaksi per bulan', barChart(monthlyBuckets(app.interactions, function (i) { return i.at; }), 'Interaksi per bulan')),
        H.card('Interaksi menurut jenis', hbars(typeItems, 'Belum ada interaksi pada periode ini.'))
      )
    );

    // Status dan kota
    const statusCounts = countBy(customers, function (c) { return c.status; });
    const statusItems = [
      { label: 'Aktif', value: statusCounts.aktif || 0, cls: 'fill-ok' },
      { label: 'Prospek', value: statusCounts.prospek || 0, cls: 'fill-info' },
      { label: 'Tidak aktif', value: statusCounts.nonaktif || 0, cls: 'fill-muted' }
    ];

    const cityCounts = countBy(customers, function (c) { return c.city || 'Tanpa kota'; });
    const cityItems = Object.keys(cityCounts)
      .map(function (name) { return { label: name, value: cityCounts[name] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 5);

    root.append(
      h('div', { class: 'grid-2' },
        H.card('Pelanggan menurut status', hbars(statusItems, '')),
        H.card('Kota teratas', hbars(cityItems, 'Belum ada data kota.'))
      )
    );

    // Paling sering dihubungi dan perlu perhatian
    const byCustomer = countBy(inPeriod, function (i) { return i.customerId; });
    const topContacted = customers
      .filter(function (c) { return byCustomer[c.id]; })
      .sort(function (a, b) { return byCustomer[b.id] - byCustomer[a.id]; })
      .slice(0, 5);

    const lastContact = {};
    app.interactions.forEach(function (i) {
      if (!lastContact[i.customerId] || i.at > lastContact[i.customerId]) lastContact[i.customerId] = i.at;
    });

    const needsAttention = customers
      .filter(function (c) {
        if (c.status === 'nonaktif') return false;
        const last = lastContact[c.id];
        return !last || UI.daysSince(last) >= IDLE_DAYS;
      })
      .sort(function (a, b) { return (lastContact[a.id] || 0) - (lastContact[b.id] || 0); })
      .slice(0, 6);

    function personRow(c, chip) {
      return h('li', {},
        h('button', { type: 'button', class: 'who-btn', onclick: function () { Views.openDetail(c); }, 'aria-label': 'Buka detail ' + c.name }, H.who(c, 34)),
        chip
      );
    }

    root.append(
      h('div', { class: 'grid-2' },
        H.card('Paling sering dihubungi',
          topContacted.length
            ? h('ul', { class: 'mini-list' }, topContacted.map(function (c) {
                return personRow(c, h('span', { class: 'chip chip-ok', text: byCustomer[c.id] + ' interaksi' }));
              }))
            : h('p', { class: 'muted-text', text: 'Belum ada interaksi pada periode ini.' })),
        H.card('Perlu perhatian',
          needsAttention.length
            ? h('ul', { class: 'mini-list' }, needsAttention.map(function (c) {
                const last = lastContact[c.id];
                return personRow(c, h('span', {
                  class: 'chip ' + (last ? 'chip-warn' : 'chip-danger'),
                  text: last ? UI.daysSince(last) + ' hari lalu' : 'Belum pernah'
                }));
              }))
            : h('p', { class: 'muted-text', text: 'Semua pelanggan aktif dan prospek dihubungi dalam ' + IDLE_DAYS + ' hari terakhir.' }),
          null)
      ),
      h('p', { class: 'report-foot', text: '"Perlu perhatian" menampilkan pelanggan aktif atau prospek yang belum dihubungi selama ' + IDLE_DAYS + ' hari atau lebih.' })
    );
  }

  Views.routes.laporan = renderReports;
})(window);
