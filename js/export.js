/* Relasi – ekspor data ke Excel (.xlsx) */
(function (global) {
  'use strict';

  const UI = global.RelasiUI;
  const Xlsx = global.RelasiXlsx;

  const DAY = 86400000;

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function buildSheets(app) {
    const today = UI.todayStr();
    const customers = app.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
    const names = {};
    app.customers.forEach(function (c) { names[c.id] = c.name; });

    const byCustomer = {};
    app.interactions.forEach(function (i) {
      const entry = byCustomer[i.customerId] || (byCustomer[i.customerId] = { count: 0, last: 0 });
      entry.count++;
      if (i.at > entry.last) entry.last = i.at;
    });

    const total = customers.length;
    const count = function (status) { return customers.filter(function (c) { return c.status === status; }).length; };
    const recent = app.interactions.filter(function (i) { return i.at >= Date.now() - 30 * DAY; }).length;
    const overdue = customers.filter(function (c) { return c.followUpDate && c.followUpDate < today; }).length;

    const summary = {
      name: 'Ringkasan',
      columns: [
        { header: 'Keterangan', width: 32, type: 'text' },
        { header: 'Nilai', width: 22, type: 'mixed' }
      ],
      rows: [
        ['Total pelanggan', total],
        ['Pelanggan aktif', count('aktif')],
        ['Prospek', count('prospek')],
        ['Tidak aktif', count('nonaktif')],
        ['Total interaksi', app.interactions.length],
        ['Interaksi 30 hari terakhir', recent],
        ['Tindak lanjut terlambat', overdue],
        ['Diekspor oleh', app.user.name],
        ['Tanggal ekspor', today]
      ]
    };

    const customerSheet = {
      name: 'Pelanggan',
      columns: [
        { header: 'Nama', width: 26, type: 'text' },
        { header: 'Perusahaan', width: 26, type: 'text' },
        { header: 'Telepon', width: 18, type: 'text' },
        { header: 'Email', width: 28, type: 'text' },
        { header: 'Kota', width: 16, type: 'text' },
        { header: 'Status', width: 13, type: 'text' },
        { header: 'Tindak lanjut', width: 16, type: 'date' },
        { header: 'Jumlah interaksi', width: 16, type: 'number' },
        { header: 'Interaksi terakhir', width: 20, type: 'datetime' },
        { header: 'Ditambahkan', width: 16, type: 'date' },
        { header: 'Catatan', width: 44, type: 'text' }
      ],
      rows: customers.map(function (c) {
        const info = byCustomer[c.id];
        return [
          c.name, c.company, c.phone, c.email, c.city,
          (UI.STATUS[c.status] || UI.STATUS.prospek).label,
          c.followUpDate,
          info ? info.count : 0,
          info ? info.last : '',
          c.createdAt,
          c.notes
        ];
      })
    };

    const interactionSheet = {
      name: 'Interaksi',
      columns: [
        { header: 'Pelanggan', width: 26, type: 'text' },
        { header: 'Jenis', width: 13, type: 'text' },
        { header: 'Tanggal', width: 20, type: 'datetime' },
        { header: 'Ringkasan', width: 60, type: 'text' }
      ],
      rows: app.interactions.slice().sort(function (a, b) { return b.at - a.at; }).map(function (i) {
        return [
          names[i.customerId] || '(pelanggan dihapus)',
          (UI.INTERACTION[i.type] || { label: i.type }).label,
          i.at,
          i.note
        ];
      })
    };

    const activitySheet = {
      name: 'Aktivitas',
      columns: [
        { header: 'Waktu', width: 20, type: 'datetime' },
        { header: 'Aktivitas', width: 28, type: 'text' },
        { header: 'Keterangan', width: 60, type: 'text' }
      ],
      rows: app.activities.map(function (a) {
        return [a.createdAt, (app.meta[a.type] || { label: a.type }).label, a.detail];
      })
    };

    return [summary, customerSheet, interactionSheet, activitySheet];
  }

  async function run(app) {
    try {
      const sheets = buildSheets(app);
      const blob = Xlsx.build(sheets);
      const filename = 'relasi-pelanggan-' + UI.todayStr() + '.xlsx';
      download(blob, filename);
      await app.log('export_excel', 'Mengekspor ' + app.customers.length + ' pelanggan, ' +
        app.interactions.length + ' interaksi ke ' + filename);
      UI.toast('File ' + filename + ' diunduh');
    } catch (error) {
      UI.toast(error.message || 'Ekspor gagal. Coba lagi.', 'error');
    }
  }

  global.RelasiExport = { run: run, buildSheets: buildSheets };
})(window);
