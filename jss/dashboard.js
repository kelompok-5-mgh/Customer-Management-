/* Relasi – dasbor sementara: cek sesi dan tampilkan aktivitas */
(function () {
  'use strict';

  const DB = window.RelasiDB;
  const Session = window.RelasiSession;
  const $ = function (selector) { return document.querySelector(selector); };

  const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const dateOnly = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' });

  function showError(message) {
    const box = $('#page-error');
    box.textContent = message;
    box.hidden = false;
  }

  function renderActivities(rows) {
    const list = $('#activity-list');
    list.textContent = '';

    if (!rows.length) {
      $('#activity-empty').hidden = false;
      return;
    }

    rows.forEach(function (row) {
      const meta = DB.ACTIVITY_META[row.type] || { label: row.type, tone: 'neutral' };

      const item = document.createElement('li');

      const dot = document.createElement('span');
      dot.className = 'dot ' + meta.tone;
      dot.setAttribute('aria-hidden', 'true');

      const text = document.createElement('div');
      const title = document.createElement('span');
      title.className = 'activity-title';
      title.textContent = meta.label;
      text.appendChild(title);

      if (row.detail) {
        const detail = document.createElement('span');
        detail.className = 'activity-detail';
        detail.textContent = row.detail;
        text.appendChild(detail);
      }

      const time = document.createElement('time');
      time.dateTime = new Date(row.createdAt).toISOString();
      time.textContent = dateTime.format(new Date(row.createdAt));

      item.append(dot, text, time);
      list.appendChild(item);
    });
  }

  async function init() {
    const session = Session.get();
    if (!session) {
      window.location.replace('index.html');
      return;
    }

    try {
      const user = await DB.getUserById(session.userId);
      if (!user) {
        Session.clear();
        window.location.replace('index.html');
        return;
      }

      $('#welcome-title').textContent = 'Halo, ' + user.name;
      $('#fact-email').textContent = user.email;
      $('#fact-created').textContent = dateOnly.format(new Date(user.createdAt));

      await DB.logActivity({
        userId: user.id, email: user.email, type: 'dashboard_open', detail: 'Membuka dasbor'
      });

      const all = await DB.listActivities(user.id, 0);
      $('#fact-total').textContent = String(all.length);
      renderActivities(all.slice(0, 20));
    } catch (error) {
      showError(error.message || 'Data tidak bisa dimuat. Muat ulang halaman ini.');
    }
  }

  $('#logout').addEventListener('click', async function () {
    const session = Session.get();
    if (session) {
      await DB.logActivity({
        userId: session.userId, email: session.email, type: 'logout', detail: 'Keluar dari akun'
      });
    }
    Session.clear();
    window.location.replace('index.html');
  });

  init();
})();
