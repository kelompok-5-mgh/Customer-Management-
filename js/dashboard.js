/* Relasi – kerangka dasbor: sesi, navigasi, profil dan foto */
(function () {
  'use strict';

  const DB = window.RelasiDB;
  const Session = window.RelasiSession;
  const UI = window.RelasiUI;
  const Views = window.RelasiViews;
  const h = UI.h;
  const $ = function (selector) { return document.querySelector(selector); };

  const TITLES = {
    'dasbor': 'Dasbor',
    'pelanggan': 'Pelanggan',
    'tindak-lanjut': 'Tindak lanjut',
    'aktivitas': 'Aktivitas'
  };

  const App = {
    user: null,
    customers: [],
    activities: [],
    meta: DB.ACTIVITY_META,
    query: '',
    statusFilter: 'semua',
    sort: 'terbaru',
    activityLimit: 30,
    ready: false,
    log: function (type, detail) {
      return DB.logActivity({ userId: App.user.id, name: App.user.name, type: type, detail: detail });
    },
    refresh: refresh,
    renderView: renderView,
    navigate: navigate
  };
  window.RelasiApp = App;

  function showError(message) {
    const box = $('#page-error');
    box.textContent = message;
    box.hidden = false;
  }

  /* ---------- Data dan tampilan ---------- */

  async function loadData() {
    const results = await Promise.all([
      DB.listCustomers(App.user.id),
      DB.listActivities(App.user.id, 0)
    ]);
    App.customers = results[0];
    App.activities = results[1];
  }

  function renderChrome() {
    const stats = Views.stats(App.customers);

    const count = $('#nav-count');
    count.textContent = String(stats.total);
    count.hidden = !stats.total;

    const due = $('#nav-followup');
    due.textContent = String(stats.due);
    due.hidden = !stats.due;
  }

  function currentRoute() {
    const match = window.location.hash.match(/^#\/([a-z-]+)/);
    return match && TITLES[match[1]] ? match[1] : 'dasbor';
  }

  function navigate(route) {
    window.location.hash = '#/' + route;
  }

  function renderView() {
    if (!App.ready) return;
    const route = currentRoute();

    $('#page-title').textContent = TITLES[route];
    document.title = TITLES[route] + ' – Relasi';

    document.querySelectorAll('.nav-link').forEach(function (link) {
      const active = link.dataset.route === route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const view = $('#view');
    view.replaceChildren();
    try {
      Views.routes[route](view, App);
    } catch (error) {
      showError('Halaman gagal ditampilkan: ' + error.message);
    }
  }

  async function refresh() {
    await loadData();
    renderChrome();
    renderView();
  }

  /* ---------- Profil (pojok kanan atas) ---------- */

  function renderProfile() {
    $('#profile-name').textContent = App.user.name;
    $('#menu-name').textContent = App.user.name;
    $('#profile-avatar').replaceChildren(UI.avatar(App.user, 36));
    $('#menu-avatar').replaceChildren(UI.avatar(App.user, 44));
    $('#menu-photo-remove').hidden = !App.user.photo;
  }

  const profileButton = $('#profile-btn');
  const profileMenu = $('#profile-menu');

  function openMenu() {
    profileMenu.hidden = false;
    profileButton.setAttribute('aria-expanded', 'true');
    const first = profileMenu.querySelector('.menu-item:not([hidden])');
    if (first) first.focus();
  }

  function closeMenu(returnFocus) {
    if (profileMenu.hidden) return;
    profileMenu.hidden = true;
    profileButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) profileButton.focus();
  }

  profileButton.addEventListener('click', function () {
    if (profileMenu.hidden) openMenu();
    else closeMenu(false);
  });

  document.addEventListener('click', function (event) {
    if (!profileMenu.hidden && !event.target.closest('.profile')) closeMenu(false);
  });

  profileMenu.addEventListener('keydown', function (event) {
    const items = Array.prototype.slice.call(profileMenu.querySelectorAll('.menu-item:not([hidden])'));
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    }
  });

  /* ---------- Foto profil ---------- */

  const photoDialog = $('#photo-dialog');
  const photoPreview = $('#photo-preview');
  const photoSave = $('#photo-save');
  const photoError = $('#photo-error');
  const photoFile = $('#photo-file');
  let pendingPhoto = null;

  function fileToAvatar(file, size) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(
          img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size
        );
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('File ini tidak bisa dibaca sebagai gambar.'));
      };
      img.src = url;
    });
  }

  function openPhotoDialog() {
    pendingPhoto = null;
    photoFile.value = '';
    photoError.textContent = '';
    photoSave.disabled = true;
    photoPreview.replaceChildren(UI.avatar(App.user, 112));
    photoDialog.showModal();
  }

  photoFile.addEventListener('change', async function () {
    const file = photoFile.files && photoFile.files[0];
    photoError.textContent = '';
    if (!file) return;

    if (file.type.indexOf('image/') !== 0) {
      photoError.textContent = 'Pilih file gambar (JPG, PNG, atau WebP).';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      photoError.textContent = 'Ukuran foto terlalu besar. Pilih foto di bawah 12 MB.';
      return;
    }

    try {
      pendingPhoto = await fileToAvatar(file, 256);
      photoPreview.replaceChildren(UI.avatar({ name: App.user.name, photo: pendingPhoto }, 112));
      photoSave.disabled = false;
    } catch (error) {
      photoError.textContent = error.message;
    }
  });

  photoSave.addEventListener('click', async function () {
    if (!pendingPhoto) return;
    photoSave.disabled = true;
    try {
      const updated = Object.assign({}, App.user, { photo: pendingPhoto });
      await DB.saveUser(updated);
      App.user = updated;
      await App.log('photo_update', 'Memperbarui foto profil');
      renderProfile();
      photoDialog.close();
      UI.toast('Foto profil diperbarui');
      await refresh();
    } catch (error) {
      photoError.textContent = error.message || 'Foto gagal disimpan.';
      photoSave.disabled = false;
    }
  });

  $('#menu-photo').addEventListener('click', function () {
    closeMenu(false);
    openPhotoDialog();
  });

  $('#menu-photo-remove').addEventListener('click', async function () {
    closeMenu(false);
    try {
      const updated = Object.assign({}, App.user, { photo: null });
      await DB.saveUser(updated);
      App.user = updated;
      await App.log('photo_remove', 'Menghapus foto profil');
      renderProfile();
      UI.toast('Foto profil dihapus');
      await refresh();
    } catch (error) {
      UI.toast(error.message || 'Foto gagal dihapus.', 'error');
    }
  });

  /* ---------- Keluar ---------- */

  $('#menu-logout').addEventListener('click', async function () {
    await App.log('logout', 'Keluar dari akun');
    Session.clear();
    window.location.replace('index.html');
  });

  /* ---------- Menu samping (layar kecil) ---------- */

  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const menuToggle = $('#menu-toggle');

  function setSidebar(open) {
    sidebar.classList.toggle('is-open', open);
    scrim.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  }

  menuToggle.addEventListener('click', function () { setSidebar(!sidebar.classList.contains('is-open')); });
  scrim.addEventListener('click', function () { setSidebar(false); });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    setSidebar(false);
    closeMenu(true);
  });

  /* ---------- Pencarian di bar atas ---------- */

  $('#global-search').addEventListener('submit', function (event) {
    event.preventDefault();
    App.query = $('#search-input').value;
    $('#search-input').value = '';
    if (currentRoute() === 'pelanggan') renderView();
    else navigate('pelanggan');
  });

  window.addEventListener('hashchange', function () {
    setSidebar(false);
    renderView();
    window.scrollTo(0, 0);
  });

  /* ---------- Mulai ---------- */

  async function init() {
    UI.hydrateIcons();

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

      App.user = user;
      renderProfile();

      await DB.logActivity({ userId: user.id, name: user.name, type: 'dashboard_open', detail: 'Membuka dasbor' });
      await loadData();
      App.ready = true;
      renderChrome();
      renderView();
    } catch (error) {
      showError(error.message || 'Data tidak bisa dimuat. Muat ulang halaman ini.');
    }
  }

  init();
})();
