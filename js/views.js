/* Relasi – isi halaman: dasbor, pelanggan, tindak lanjut, aktivitas */
(function (global) {
  'use strict';

  const DB = global.RelasiDB;
  const UI = global.RelasiUI;
  const Sec = global.RelasiSecurity;
  const h = UI.h;
  const icon = UI.icon;
  const $ = function (selector) { return document.querySelector(selector); };

  let App = null; // diisi dari dashboard.js saat halaman dirender

  /* ---------- Bantuan umum ---------- */

  function stats(list) {
    const today = UI.todayStr();
    return {
      total: list.length,
      aktif: list.filter(function (c) { return c.status === 'aktif'; }).length,
      prospek: list.filter(function (c) { return c.status === 'prospek'; }).length,
      due: list.filter(function (c) { return c.followUpDate && c.followUpDate <= today; }).length
    };
  }

  function statusChip(status) {
    const s = UI.STATUS[status] || UI.STATUS.prospek;
    return h('span', { class: 'chip ' + s.cls, text: s.label });
  }

  function who(c, size) {
    return h('span', { class: 'who' },
      UI.avatar(c, size || 38),
      h('span', { class: 'who-text' },
        h('strong', { text: c.name }),
        c.company ? h('small', { text: c.company }) : null
      )
    );
  }

  function activityItem(row) {
    const meta = App.meta[row.type] || { label: row.type, tone: 'neutral' };
    return h('li', {},
      h('span', { class: 'dot ' + meta.tone, 'aria-hidden': 'true' }),
      h('div', {},
        h('span', { class: 'activity-title', text: meta.label }),
        row.detail ? h('span', { class: 'activity-detail', text: row.detail }) : null
      ),
      h('time', { datetime: new Date(row.createdAt).toISOString(), text: UI.formatDateTime(row.createdAt) })
    );
  }

  function emptyState(title, text, actions) {
    return h('div', { class: 'empty' },
      h('span', { class: 'empty-icon' }, icon('inbox', 28)),
      h('h3', { text: title }),
      text ? h('p', { text: text }) : null,
      actions && actions.length ? h('div', { class: 'empty-actions' }, actions.map(function (a) {
        return h('button', { type: 'button', class: 'btn btn-inline ' + (a.primary ? 'btn-primary' : 'btn-ghost'), onclick: a.onclick }, a.label);
      })) : null
    );
  }

  function card(title, body, link) {
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', { text: title }),
        link ? h('a', { class: 'card-link', href: link.href, text: link.text }) : null
      ),
      body
    );
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  /* ---------- Dasbor ---------- */

  function statCard(opts) {
    const inner = [
      h('span', { class: 'stat-icon ' + (opts.tone || '') }, icon(opts.icon, 22)),
      h('span', { class: 'stat-value', text: String(opts.value) }),
      h('span', { class: 'stat-label', text: opts.label })
    ];
    return opts.href
      ? h('a', { class: 'stat stat-link', href: opts.href }, inner)
      : h('div', { class: 'stat' }, inner);
  }

  function monthBuckets(customers) {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: d.getFullYear() + '-' + d.getMonth(), label: UI.formatMonth(d), count: 0 });
    }
    customers.forEach(function (c) {
      const d = new Date(c.createdAt);
      const key = d.getFullYear() + '-' + d.getMonth();
      const bucket = buckets.find(function (b) { return b.key === key; });
      if (bucket) bucket.count++;
    });
    return buckets;
  }

  function chart(customers) {
    const buckets = monthBuckets(customers);
    const max = Math.max.apply(null, buckets.map(function (b) { return b.count; }).concat(1));
    const summary = buckets.map(function (b) { return b.label + ' ' + b.count; }).join(', ');

    return h('div', { class: 'bars', role: 'img', 'aria-label': 'Pelanggan baru per bulan: ' + summary },
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

  function followupRows(list, limit) {
    const today = UI.todayStr();
    return h('ul', { class: 'mini-list' }, list.slice(0, limit).map(function (c) {
      const overdue = c.followUpDate < today;
      return h('li', {},
        h('button', { type: 'button', class: 'who-btn', onclick: function () { openCustomerDialog(c); }, 'aria-label': 'Buka ' + c.name }, who(c, 34)),
        h('span', { class: 'chip ' + (overdue ? 'chip-danger' : (c.followUpDate === today ? 'chip-warn' : 'chip-info')), text: UI.relativeDay(c.followUpDate) })
      );
    }));
  }

  function renderDashboard(root, app) {
    App = app;
    const customers = app.customers;
    const s = stats(customers);
    const firstName = app.user.name.split(' ')[0];

    let subtitle;
    if (!s.total) subtitle = 'Mulai dengan menambahkan pelanggan pertama Anda.';
    else if (s.due) subtitle = s.due + ' pelanggan perlu ditindaklanjuti hari ini atau sudah lewat jadwal.';
    else subtitle = 'Tidak ada tindak lanjut yang tertunda. Kerja bagus.';

    root.append(
      h('section', { class: 'hero' },
        h('div', {},
          h('h2', { text: greeting() + ', ' + firstName }),
          h('p', { text: subtitle })
        ),
        h('button', { type: 'button', class: 'btn btn-primary btn-inline', onclick: function () { openCustomerDialog(); } }, icon('plus', 18), 'Tambah pelanggan')
      ),

      h('div', { class: 'stats' },
        statCard({ icon: 'users', label: 'Total pelanggan', value: s.total }),
        statCard({ icon: 'star', label: 'Pelanggan aktif', value: s.aktif, tone: 'tone-ok' }),
        statCard({ icon: 'trend', label: 'Prospek', value: s.prospek, tone: 'tone-info' }),
        statCard({ icon: 'bell', label: 'Perlu tindak lanjut', value: s.due, tone: s.due ? 'tone-alert' : '', href: '#/tindak-lanjut' })
      )
    );

    if (!s.total) {
      root.append(
        h('section', { class: 'card' }, emptyState(
          'Belum ada pelanggan',
          'Tambahkan pelanggan satu per satu, atau muat beberapa data contoh untuk melihat cara kerja Relasi.',
          [
            { label: 'Tambah pelanggan', primary: true, onclick: function () { openCustomerDialog(); } },
            { label: 'Muat data contoh', onclick: loadSample }
          ]
        ))
      );
    } else {
      const upcoming = customers.filter(function (c) { return c.followUpDate; })
        .sort(function (a, b) { return a.followUpDate.localeCompare(b.followUpDate); });
      const recent = customers.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 5);

      root.append(
        h('div', { class: 'grid-2' },
          card('Pelanggan baru, 6 bulan terakhir', chart(customers)),
          card('Tindak lanjut terdekat',
            upcoming.length ? followupRows(upcoming, 5) : h('p', { class: 'muted-text', text: 'Belum ada tindak lanjut terjadwal.' }),
            upcoming.length ? { href: '#/tindak-lanjut', text: 'Lihat semua' } : null)
        ),
        h('div', { class: 'grid-2' },
          card('Pelanggan terbaru',
            h('ul', { class: 'mini-list' }, recent.map(function (c) {
              return h('li', {},
                h('button', { type: 'button', class: 'who-btn', onclick: function () { openCustomerDialog(c); }, 'aria-label': 'Buka ' + c.name }, who(c, 34)),
                statusChip(c.status)
              );
            })),
            { href: '#/pelanggan', text: 'Semua pelanggan' }),
          card('Aktivitas terakhir',
            h('ul', { class: 'activity' }, app.activities.slice(0, 5).map(activityItem)),
            { href: '#/aktivitas', text: 'Lihat semua' })
        )
      );
    }
  }

  /* ---------- Pelanggan ---------- */

  function contactCell(c) {
    if (!c.phone && !c.email) return '–';
    return h('span', { class: 'contact-lines' },
      c.phone ? h('span', { text: c.phone }) : null,
      c.email ? h('small', { text: c.email }) : null
    );
  }

  function followCell(c) {
    if (!c.followUpDate) return '–';
    const overdue = c.followUpDate < UI.todayStr();
    return h('span', { class: 'follow' + (overdue ? ' is-overdue' : '') },
      UI.formatDay(c.followUpDate),
      h('small', { text: UI.relativeDay(c.followUpDate) })
    );
  }

  function renderCustomers(root, app) {
    App = app;

    const search = h('input', {
      type: 'search', id: 'cu-search', placeholder: 'Cari nama, usaha, kontak, atau kota',
      value: app.query, 'aria-label': 'Cari pelanggan', autocomplete: 'off'
    });

    const statusSelect = h('select', { id: 'cu-filter', 'aria-label': 'Filter status' },
      h('option', { value: 'semua', text: 'Semua status' }),
      h('option', { value: 'aktif', text: 'Aktif' }),
      h('option', { value: 'prospek', text: 'Prospek' }),
      h('option', { value: 'nonaktif', text: 'Tidak aktif' })
    );
    statusSelect.value = app.statusFilter;

    const sortSelect = h('select', { id: 'cu-sort', 'aria-label': 'Urutkan' },
      h('option', { value: 'terbaru', text: 'Terbaru' }),
      h('option', { value: 'nama', text: 'Nama A–Z' }),
      h('option', { value: 'tindak', text: 'Tindak lanjut terdekat' })
    );
    sortSelect.value = app.sort;

    const count = h('p', { class: 'list-count', 'aria-live': 'polite' });
    const holder = h('div', { class: 'card card-flush' });

    function filtered() {
      const q = app.query.trim().toLowerCase();
      let list = app.customers.filter(function (c) {
        if (app.statusFilter !== 'semua' && c.status !== app.statusFilter) return false;
        if (!q) return true;
        return [c.name, c.company, c.phone, c.email, c.city].some(function (value) {
          return String(value || '').toLowerCase().indexOf(q) !== -1;
        });
      });

      list = list.slice();
      if (app.sort === 'nama') {
        list.sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
      } else if (app.sort === 'tindak') {
        list.sort(function (a, b) {
          if (!a.followUpDate && !b.followUpDate) return 0;
          if (!a.followUpDate) return 1;
          if (!b.followUpDate) return -1;
          return a.followUpDate.localeCompare(b.followUpDate);
        });
      } else {
        list.sort(function (a, b) { return b.createdAt - a.createdAt; });
      }
      return list;
    }

    function draw() {
      const list = filtered();
      count.textContent = app.customers.length
        ? 'Menampilkan ' + list.length + ' dari ' + app.customers.length + ' pelanggan'
        : '';

      if (!app.customers.length) {
        holder.replaceChildren(emptyState(
          'Belum ada pelanggan',
          'Tambahkan pelanggan pertama Anda, atau muat data contoh untuk mencoba.',
          [
            { label: 'Tambah pelanggan', primary: true, onclick: function () { openCustomerDialog(); } },
            { label: 'Muat data contoh', onclick: loadSample }
          ]
        ));
        return;
      }

      if (!list.length) {
        holder.replaceChildren(emptyState('Tidak ada yang cocok', 'Coba kata kunci lain atau ubah filter status.', [
          { label: 'Hapus pencarian', onclick: function () {
            app.query = ''; app.statusFilter = 'semua'; search.value = ''; statusSelect.value = 'semua'; draw();
          } }
        ]));
        return;
      }

      const head = ['Pelanggan', 'Kontak', 'Kota', 'Status', 'Tindak lanjut'].map(function (t) {
        return h('th', { scope: 'col', text: t });
      });
      head.push(h('th', { scope: 'col', class: 'col-actions' }, h('span', { class: 'sr-only', text: 'Aksi' })));

      const rows = list.map(function (c) {
        return h('tr', {},
          h('td', { 'data-label': 'Pelanggan' },
            h('button', { type: 'button', class: 'who-btn', onclick: function () { openCustomerDialog(c); }, 'aria-label': 'Ubah ' + c.name }, who(c))),
          h('td', { 'data-label': 'Kontak' }, contactCell(c)),
          h('td', { 'data-label': 'Kota', text: c.city || '–' }),
          h('td', { 'data-label': 'Status' }, statusChip(c.status)),
          h('td', { 'data-label': 'Tindak lanjut' }, followCell(c)),
          h('td', { class: 'col-actions' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Ubah ' + c.name, title: 'Ubah', onclick: function () { openCustomerDialog(c); } }, icon('edit', 18)),
            h('button', { type: 'button', class: 'icon-btn icon-danger', 'aria-label': 'Hapus ' + c.name, title: 'Hapus', onclick: function () { askDelete(c); } }, icon('trash', 18))
          )
        );
      });

      holder.replaceChildren(h('div', { class: 'table-wrap' },
        h('table', { class: 'table' }, h('thead', {}, h('tr', {}, head)), h('tbody', {}, rows))
      ));
    }

    search.addEventListener('input', function () { app.query = search.value; draw(); });
    statusSelect.addEventListener('change', function () { app.statusFilter = statusSelect.value; draw(); });
    sortSelect.addEventListener('change', function () { app.sort = sortSelect.value; draw(); });

    root.append(
      h('div', { class: 'toolbar' },
        h('div', { class: 'toolbar-search' }, h('span', { class: 'search-icon' }, icon('search', 18)), search),
        statusSelect,
        sortSelect,
        h('button', { type: 'button', class: 'btn btn-primary btn-inline', onclick: function () { openCustomerDialog(); } }, icon('plus', 18), 'Tambah pelanggan')
      ),
      count,
      holder
    );
    draw();
  }

  /* ---------- Tindak lanjut ---------- */

  async function finishFollowup(c) {
    try {
      await DB.updateCustomer(Object.assign({}, c, { followUpDate: '' }));
      await App.log('followup_done', 'Tindak lanjut selesai: ' + c.name);
      UI.toast('Tindak lanjut ' + c.name + ' ditandai selesai');
      await App.refresh();
    } catch (error) {
      UI.toast(error.message || 'Gagal menyimpan perubahan.', 'error');
    }
  }

  function renderFollowups(root, app) {
    App = app;
    const today = UI.todayStr();
    const items = app.customers.filter(function (c) { return c.followUpDate; })
      .sort(function (a, b) { return a.followUpDate.localeCompare(b.followUpDate); });

    root.append(h('p', { class: 'page-intro', text: 'Pelanggan yang perlu dihubungi, diurutkan dari jadwal terdekat.' }));

    if (!items.length) {
      root.append(h('section', { class: 'card' }, emptyState(
        'Tidak ada tindak lanjut terjadwal',
        'Isi tanggal tindak lanjut saat menambah atau mengubah pelanggan, lalu jadwalnya muncul di sini.',
        [{ label: 'Lihat pelanggan', onclick: function () { App.navigate('pelanggan'); } }]
      )));
      return;
    }

    const groups = [
      { title: 'Terlambat', cls: 'chip-danger', rows: items.filter(function (c) { return c.followUpDate < today; }) },
      { title: 'Hari ini', cls: 'chip-warn', rows: items.filter(function (c) { return c.followUpDate === today; }) },
      { title: 'Mendatang', cls: 'chip-info', rows: items.filter(function (c) { return c.followUpDate > today; }) }
    ];

    groups.forEach(function (group) {
      if (!group.rows.length) return;
      root.append(h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { text: group.title + ' (' + group.rows.length + ')' })),
        h('ul', { class: 'follow-list' }, group.rows.map(function (c) {
          return h('li', {},
            who(c, 40),
            h('span', { class: 'follow-meta' },
              h('span', { class: 'chip ' + group.cls, text: UI.relativeDay(c.followUpDate) }),
              h('small', { text: UI.formatDay(c.followUpDate) + (c.phone ? ' · ' + c.phone : '') })
            ),
            h('span', { class: 'follow-actions' },
              h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () { openCustomerDialog(c); } }, 'Ubah'),
              h('button', { type: 'button', class: 'btn btn-primary btn-sm btn-inline', onclick: function () { finishFollowup(c); } }, icon('check', 16), 'Selesai')
            )
          );
        }))
      ));
    });
  }

  /* ---------- Aktivitas ---------- */

  function renderActivities(root, app) {
    App = app;
    root.append(h('p', { class: 'page-intro', text: 'Semua aktivitas akun Anda tercatat di database perangkat ini.' }));

    if (!app.activities.length) {
      root.append(h('section', { class: 'card' }, emptyState('Belum ada aktivitas', 'Aktivitas muncul di sini setelah Anda mulai memakai Relasi.')));
      return;
    }

    const shown = app.activities.slice(0, app.activityLimit);
    const children = [h('ul', { class: 'activity' }, shown.map(activityItem))];

    if (app.activities.length > shown.length) {
      children.push(h('div', { class: 'more' },
        h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onclick: function () {
          app.activityLimit += 30;
          app.renderView();
        } }, 'Tampilkan lebih banyak')
      ));
    }

    root.append(h('section', { class: 'card card-flush' }, children));
  }

  /* ---------- Dialog pelanggan ---------- */

  const cuDialog = $('#customer-dialog');
  const cuForm = $('#customer-form');
  const confirmDialog = $('#confirm-dialog');
  let editing = null;
  let pendingDelete = null;

  const FIELD_IDS = ['name', 'company', 'phone', 'email', 'city', 'status', 'followup', 'notes'];

  function clearFormErrors() {
    cuForm.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    cuForm.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    $('#cu-form-error').hidden = true;
  }

  function setFieldError(id, message) {
    const input = $('#cu-' + id);
    $('#cu-' + id + '-error').textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'cu-' + id + '-error');
  }

  function openCustomerDialog(customer) {
    editing = customer || null;
    clearFormErrors();

    $('#customer-dialog-title').textContent = editing ? 'Ubah pelanggan' : 'Tambah pelanggan';
    $('#cu-save').textContent = editing ? 'Simpan perubahan' : 'Simpan pelanggan';

    const c = editing || { status: 'prospek' };
    $('#cu-name').value = c.name || '';
    $('#cu-company').value = c.company || '';
    $('#cu-phone').value = c.phone || '';
    $('#cu-email').value = c.email || '';
    $('#cu-city').value = c.city || '';
    $('#cu-status').value = c.status || 'prospek';
    $('#cu-followup').value = c.followUpDate || '';
    $('#cu-notes').value = c.notes || '';

    cuDialog.showModal();
    $('#cu-name').focus();
  }

  cuForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearFormErrors();

    const data = {
      name: Sec.normalizeName($('#cu-name').value),
      company: $('#cu-company').value.trim(),
      phone: $('#cu-phone').value.trim(),
      email: $('#cu-email').value.trim().toLowerCase(),
      city: $('#cu-city').value.trim(),
      status: $('#cu-status').value,
      followUpDate: $('#cu-followup').value,
      notes: $('#cu-notes').value.trim()
    };

    let valid = true;
    if (data.name.length < 2) {
      setFieldError('name', 'Masukkan nama pelanggan.');
      valid = false;
    }
    if (data.phone && !/^[0-9+\-\s()]{6,24}$/.test(data.phone)) {
      setFieldError('phone', 'Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung.');
      valid = false;
    }
    if (data.email && !Sec.isEmail(data.email)) {
      setFieldError('email', 'Masukkan email yang valid, misalnya nama@contoh.com.');
      valid = false;
    }
    if (!valid) {
      const bad = cuForm.querySelector('[aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }

    const saveButton = $('#cu-save');
    const label = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan…';

    try {
      if (editing) {
        await DB.updateCustomer(Object.assign({}, editing, data));
        await App.log('customer_edit', 'Mengubah pelanggan: ' + data.name);
        UI.toast('Perubahan ' + data.name + ' disimpan');
      } else {
        await DB.addCustomer(App.user.id, data);
        await App.log('customer_add', 'Menambah pelanggan: ' + data.name);
        UI.toast(data.name + ' ditambahkan');
      }
      cuDialog.close();
      await App.refresh();
    } catch (error) {
      const box = $('#cu-form-error');
      box.textContent = error.message || 'Pelanggan gagal disimpan. Coba lagi.';
      box.hidden = false;
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = label;
    }
  });

  /* ---------- Hapus pelanggan ---------- */

  function askDelete(customer) {
    pendingDelete = customer;
    $('#confirm-text').textContent = customer.name + ' akan dihapus permanen dari perangkat ini. Tindakan ini tidak bisa dibatalkan.';
    confirmDialog.showModal();
  }

  $('#confirm-ok').addEventListener('click', async function () {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    try {
      await DB.deleteCustomer(target.id);
      await App.log('customer_delete', 'Menghapus pelanggan: ' + target.name);
      UI.toast(target.name + ' dihapus');
      confirmDialog.close();
      await App.refresh();
    } catch (error) {
      confirmDialog.close();
      UI.toast(error.message || 'Pelanggan gagal dihapus.', 'error');
    }
  });

  /* ---------- Dialog umum: tombol tutup dan klik di luar ---------- */

  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
    });
  });

  /* ---------- Data contoh ---------- */

  async function loadSample() {
    const DAY = 86400000;
    const now = Date.now();
    const sample = [
      { name: 'Siti Rahmawati', company: 'Toko Kain Sari', phone: '0812-5550-0101', email: 'siti@kainsari.example', city: 'Jakarta', status: 'aktif', followUpDate: '', notes: 'Pelanggan tetap, memesan kain setiap bulan.', createdAt: now - 150 * DAY },
      { name: 'Budi Santoso', company: 'CV Maju Jaya', phone: '0813-5550-0102', email: 'budi@majujaya.example', city: 'Bandung', status: 'prospek', followUpDate: UI.dayOffset(1), notes: 'Minta penawaran harga grosir.', createdAt: now - 12 * DAY },
      { name: 'Ayu Lestari', company: 'Warung Kopi Senja', phone: '0857-5550-0103', email: 'ayu@kopisenja.example', city: 'Yogyakarta', status: 'aktif', followUpDate: UI.dayOffset(5), notes: 'Tertarik paket langganan bulanan.', createdAt: now - 95 * DAY },
      { name: 'Dedi Kurniawan', company: 'PT Sentosa Abadi', phone: '0821-5550-0104', email: 'dedi@sentosa.example', city: 'Medan', status: 'nonaktif', followUpDate: '', notes: 'Kontrak berakhir, belum memperpanjang.', createdAt: now - 60 * DAY },
      { name: 'Rina Wulandari', company: 'Apotek Sehat', phone: '0878-5550-0105', email: 'rina@apoteksehat.example', city: 'Surabaya', status: 'prospek', followUpDate: UI.dayOffset(-2), notes: 'Sudah minta demo, belum dihubungi kembali.', createdAt: now - 30 * DAY },
      { name: 'Hendra Gunawan', company: 'UD Berkah Tani', phone: '0852-5550-0106', email: 'hendra@berkahtani.example', city: 'Makassar', status: 'aktif', followUpDate: UI.dayOffset(0), notes: 'Konfirmasi jadwal pengiriman bulan ini.', createdAt: now - 3 * DAY }
    ];

    try {
      await DB.addCustomers(App.user.id, sample);
      await App.log('sample_data', 'Memuat ' + sample.length + ' pelanggan contoh');
      UI.toast(sample.length + ' pelanggan contoh dimuat');
      await App.refresh();
    } catch (error) {
      UI.toast(error.message || 'Data contoh gagal dimuat.', 'error');
    }
  }

  global.RelasiViews = {
    routes: {
      'dasbor': renderDashboard,
      'pelanggan': renderCustomers,
      'tindak-lanjut': renderFollowups,
      'aktivitas': renderActivities
    },
    openCustomerDialog: openCustomerDialog,
    stats: stats
  };
})(window);
