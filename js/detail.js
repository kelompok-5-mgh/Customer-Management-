/* Relasi – detail pelanggan dan riwayat interaksi */
(function (global) {
  'use strict';

  const DB = global.RelasiDB;
  const UI = global.RelasiUI;
  const Views = global.RelasiViews;
  const H = Views.helpers;
  const h = UI.h;
  const icon = UI.icon;
  const $ = function (selector) { return document.querySelector(selector); };

  const ixDialog = $('#interaction-dialog');
  const ixForm = $('#interaction-form');
  let ixCustomer = null;

  /* ---------- Dialog catat interaksi ---------- */

  function clearIxErrors() {
    ixForm.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    ixForm.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    $('#ix-form-error').hidden = true;
  }

  function setIxError(id, message) {
    const input = $('#ix-' + id);
    $('#ix-' + id + '-error').textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'ix-' + id + '-error');
  }

  function openInteractionDialog(customer) {
    ixCustomer = customer;
    clearIxErrors();
    $('#interaction-dialog-title').textContent = 'Catat interaksi dengan ' + customer.name;
    $('#ix-type').value = 'telepon';
    $('#ix-date').value = UI.toLocalInput(Date.now());
    $('#ix-note').value = '';
    $('#ix-followup').value = customer.followUpDate || '';
    ixDialog.showModal();
    $('#ix-note').focus();
  }

  ixForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearIxErrors();

    const app = global.RelasiApp;
    const type = $('#ix-type').value;
    const note = $('#ix-note').value.trim();
    const at = new Date($('#ix-date').value).getTime();
    const followUp = $('#ix-followup').value;

    let valid = true;
    if (isNaN(at)) {
      setIxError('date', 'Pilih tanggal dan jam interaksi.');
      valid = false;
    }
    if (note.length < 2) {
      setIxError('note', 'Tulis ringkasan singkat tentang interaksi ini.');
      valid = false;
    }
    if (!valid) {
      const bad = ixForm.querySelector('[aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }

    const button = $('#ix-save');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Menyimpan…';

    try {
      await DB.addInteraction(app.user.id, { customerId: ixCustomer.id, type: type, note: note, at: at });

      // Tanggal tindak lanjut berikutnya (opsional) langsung disimpan ke data pelanggan
      if (followUp !== (ixCustomer.followUpDate || '')) {
        await DB.updateCustomer(Object.assign({}, ixCustomer, { followUpDate: followUp }));
      }

      const typeLabel = UI.INTERACTION[type].label.toLowerCase();
      await app.log('interaction_add', 'Mencatat ' + typeLabel + ' dengan ' + ixCustomer.name);
      UI.toast('Interaksi dengan ' + ixCustomer.name + ' dicatat');
      ixDialog.close();
      await app.refresh();
    } catch (error) {
      const box = $('#ix-form-error');
      box.textContent = error.message || 'Interaksi gagal disimpan. Coba lagi.';
      box.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  /* ---------- Halaman detail ---------- */

  function infoItem(label, content) {
    return h('div', { class: 'info-item' }, h('dt', { text: label }), h('dd', {}, content));
  }

  function phoneLink(phone) {
    const digits = phone.replace(/[^0-9+]/g, '');
    return digits ? h('a', { href: 'tel:' + digits, text: phone }) : phone;
  }

  function timelineItem(item, customer) {
    const info = UI.INTERACTION[item.type] || UI.INTERACTION.catatan;
    return h('li', {},
      h('span', { class: 'tl-icon tl-' + item.type }, icon(info.icon, 18)),
      h('div', { class: 'tl-body' },
        h('div', { class: 'tl-top' },
          h('strong', { text: info.label }),
          h('time', { datetime: new Date(item.at).toISOString(), text: UI.formatDateTime(item.at) })
        ),
        h('p', { text: item.note })
      ),
      h('button', {
        type: 'button', class: 'icon-btn icon-danger', title: 'Hapus interaksi',
        'aria-label': 'Hapus interaksi ' + info.label.toLowerCase() + ' tanggal ' + UI.formatDateTime(item.at),
        onclick: function () { askDeleteInteraction(item, customer); }
      }, icon('trash', 18))
    );
  }

  function askDeleteInteraction(item, customer) {
    const info = UI.INTERACTION[item.type] || UI.INTERACTION.catatan;
    Views.askConfirm({
      title: 'Hapus interaksi?',
      text: 'Catatan ' + info.label.toLowerCase() + ' tanggal ' + UI.formatDateTime(item.at) + ' akan dihapus permanen.',
      okLabel: 'Hapus',
      onConfirm: async function () {
        const app = global.RelasiApp;
        await DB.deleteInteraction(item.id);
        await app.log('interaction_delete', 'Menghapus ' + info.label.toLowerCase() + ' dengan ' + customer.name);
        UI.toast('Interaksi dihapus');
        await app.refresh();
      }
    });
  }

  function renderDetail(root, app, id) {
    Views.setApp(app);
    root.append(h('a', { class: 'back-link', href: '#/pelanggan' }, icon('back', 16), 'Semua pelanggan'));

    const customer = app.customers.find(function (c) { return c.id === id; });
    if (!customer) {
      root.append(h('section', { class: 'card' }, H.emptyState(
        'Pelanggan tidak ditemukan',
        'Pelanggan ini mungkin sudah dihapus.',
        [{ label: 'Kembali ke daftar pelanggan', primary: true, onclick: function () { app.navigate('pelanggan'); } }]
      )));
      return;
    }

    const items = app.interactions
      .filter(function (i) { return i.customerId === customer.id; })
      .sort(function (a, b) { return b.at - a.at; });
    const last = items[0];
    const today = UI.todayStr();

    let followChip = null;
    if (customer.followUpDate) {
      const cls = customer.followUpDate < today ? 'chip-danger' : (customer.followUpDate === today ? 'chip-warn' : 'chip-info');
      followChip = h('span', { class: 'chip ' + cls, text: 'Tindak lanjut: ' + UI.relativeDay(customer.followUpDate) });
    }

    root.append(
      h('section', { class: 'card detail-head' },
        h('div', { class: 'detail-who' },
          UI.avatar(customer, 64),
          h('div', {},
            h('h2', { text: customer.name }),
            customer.company ? h('p', { class: 'muted-text', text: customer.company }) : null,
            h('div', { class: 'detail-chips' }, H.statusChip(customer.status), followChip)
          )
        ),
        h('div', { class: 'detail-actions' },
          h('button', { type: 'button', class: 'btn btn-primary btn-inline', onclick: function () { openInteractionDialog(customer); } }, icon('plus', 18), 'Catat interaksi'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-inline', onclick: function () { Views.openCustomerDialog(customer); } }, icon('edit', 18), 'Ubah'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-inline btn-ghost-danger', onclick: function () { Views.askDelete(customer); } }, icon('trash', 18), 'Hapus')
        )
      ),

      h('dl', { class: 'card info-grid' },
        infoItem('Telepon', customer.phone ? phoneLink(customer.phone) : '–'),
        infoItem('Email', customer.email ? h('a', { href: 'mailto:' + customer.email, text: customer.email }) : '–'),
        infoItem('Kota', customer.city || '–'),
        infoItem('Tindak lanjut', customer.followUpDate ? UI.formatDay(customer.followUpDate) : '–'),
        infoItem('Interaksi terakhir', last ? UI.formatDateTime(last.at) : 'Belum ada'),
        infoItem('Ditambahkan', UI.formatDateTime(customer.createdAt))
      ),

      customer.notes ? h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { text: 'Catatan' })),
        h('p', { class: 'note-text', text: customer.notes })
      ) : null,

      h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', { text: 'Riwayat interaksi (' + items.length + ')' }),
          items.length ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-inline', onclick: function () { openInteractionDialog(customer); } }, icon('plus', 16), 'Catat') : null
        ),
        items.length
          ? h('ol', { class: 'timeline' }, items.map(function (item) { return timelineItem(item, customer); }))
          : H.emptyState(
              'Belum ada interaksi',
              'Catat telepon, pesan, email, atau pertemuan dengan pelanggan ini agar riwayatnya mudah dilacak.',
              [{ label: 'Catat interaksi pertama', primary: true, onclick: function () { openInteractionDialog(customer); } }]
            )
      )
    );
  }

  Views.routes.detail = renderDetail;
})(window);
