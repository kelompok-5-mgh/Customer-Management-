/* Relasi – alur loading, masuk, dan daftar */
(function () {
  'use strict';

  const DB = window.RelasiDB;
  const Sec = window.RelasiSecurity;
  const Session = window.RelasiSession;

  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 5 * 60 * 1000;
  const SESSION_HOURS = 8;
  const SESSION_REMEMBER_DAYS = 30;
  const MIN_LOADING_MS = 1800;

  const $ = function (selector) { return document.querySelector(selector); };
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };

  const loader = $('#loader');
  const loaderStatus = $('#loader-status');
  const progressBar = $('#progress-bar');
  const authView = $('#auth');
  const notice = $('#notice');

  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  const formLogin = $('#panel-login');
  const formRegister = $('#panel-register');

  /* ---------- Loading ---------- */

  function setProgress(percent, text) {
    progressBar.style.width = percent + '%';
    if (text) loaderStatus.textContent = text;
  }

  function showLoaderError(message) {
    loaderStatus.textContent = message;
    loaderStatus.classList.add('is-error');
    progressBar.style.width = '0%';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn-retry';
    retry.textContent = 'Muat ulang';
    retry.addEventListener('click', function () { window.location.reload(); });
    loader.appendChild(retry);
  }

  function hideLoader() {
    authView.hidden = false;
    loader.classList.add('is-leaving');
    setTimeout(function () { loader.hidden = true; }, 600);
    $('#login-name').focus({ preventScroll: true });
  }

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () { reject(new Error(message)); }, ms);
      promise.then(
        function (value) { clearTimeout(timer); resolve(value); },
        function (error) { clearTimeout(timer); reject(error); }
      );
    });
  }

  async function boot() {
    // Jika file pendukung tidak termuat, pelapor di index.html sudah menampilkan penyebabnya
    if (!DB || !Sec || !Session) return;
    window.__relasiReady = true;
    const started = performance.now();
    setProgress(15, 'Menyiapkan database…');

    try {
      await withTimeout(
        DB.open(), 8000,
        'Database tidak merespons. Tutup tab Relasi lain atau matikan mode penyamaran, lalu muat ulang.'
      );
    } catch (error) {
      showLoaderError(error.message || 'Database gagal dibuka.');
      return;
    }

    setProgress(55, 'Memeriksa sesi…');

    let session = Session.get();
    if (session) {
      try {
        const user = await DB.getUserById(session.userId);
        if (!user) {
          Session.clear();
          session = null;
        }
      } catch (error) {
        session = null;
      }
    }

    await DB.logActivity({
      userId: session ? session.userId : null,
      name: session ? session.name : null,
      type: 'app_open',
      detail: 'Aplikasi dibuka'
    });

    setProgress(85, 'Hampir selesai…');
    await wait(Math.max(0, MIN_LOADING_MS - (performance.now() - started)));

    if (session) {
      setProgress(100, 'Membuka dasbor…');
      await wait(300);
      window.location.replace('dashboard.html');
      return;
    }

    setProgress(100, 'Siap');
    await wait(250);
    hideLoader();
  }

  /* ---------- Tab dan pesan ---------- */

  function showNotice(type, message) {
    notice.className = 'notice ' + type;
    notice.textContent = message;
    notice.hidden = false;
  }

  function hideNotice() {
    notice.hidden = true;
    notice.textContent = '';
  }

  function showForm(name, options) {
    options = options || {};
    const isLogin = name === 'login';

    tabLogin.classList.toggle('is-active', isLogin);
    tabRegister.classList.toggle('is-active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));
    tabLogin.tabIndex = isLogin ? 0 : -1;
    tabRegister.tabIndex = isLogin ? -1 : 0;

    formLogin.hidden = !isLogin;
    formRegister.hidden = isLogin;

    if (!options.keepNotice) hideNotice();

    if (options.focus === 'tab') {
      (isLogin ? tabLogin : tabRegister).focus();
    } else if (options.focus !== false) {
      (isLogin ? $('#login-name') : $('#reg-name')).focus();
    }

    if (options.log) {
      DB.logActivity({
        type: 'switch_form',
        detail: isLogin ? 'Membuka formulir masuk' : 'Membuka formulir daftar'
      });
    }
  }

  /* ---------- Bantuan formulir ---------- */

  function setError(inputId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(inputId + '-error');
    error.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', inputId + '-error');
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    form.querySelectorAll('input').forEach(function (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    });
  }

  function setBusy(form, busy, busyLabel) {
    const button = form.querySelector('button[type="submit"]');
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyLabel;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function focusFirstError(form) {
    const bad = form.querySelector('[aria-invalid="true"]');
    if (bad) bad.focus();
  }

  /* ---------- Masuk ---------- */

  function validateName(name) {
    if (name.length < 3) return 'Nama minimal 3 karakter.';
    if (name.length > 40) return 'Nama maksimal 40 karakter.';
    return '';
  }

  async function handleLogin(event) {
    event.preventDefault();
    hideNotice();
    clearErrors(formLogin);

    const name = Sec.normalizeName($('#login-name').value);
    const password = $('#login-password').value;
    const remember = $('#login-remember').checked;

    let valid = true;
    if (!name) {
      setError('login-name', 'Masukkan nama Anda.');
      valid = false;
    }
    if (!password) {
      setError('login-password', 'Masukkan kata sandi Anda.');
      valid = false;
    }
    if (!valid) {
      focusFirstError(formLogin);
      return;
    }

    setBusy(formLogin, true, 'Memeriksa…');

    const genericMessage = 'Nama atau kata sandi tidak cocok. Periksa lagi, atau daftar jika belum punya akun.';

    try {
      const user = await DB.findUserByName(name);

      if (!user) {
        // Hash tiruan agar waktu respons tidak membocorkan apakah nama terdaftar
        await Sec.hashPassword(password, Sec.createSalt());
        await DB.logActivity({ name: name, type: 'login_failed', detail: 'Nama tidak terdaftar' });
        showNotice('error', genericMessage);
        return;
      }

      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        await DB.logActivity({
          userId: user.id, name: user.name, type: 'login_locked',
          detail: 'Percobaan masuk saat akun diblokir sementara'
        });
        showNotice('error', 'Terlalu banyak percobaan gagal. Coba lagi dalam ' + minutes + ' menit.');
        return;
      }

      const hash = await Sec.hashPassword(password, user.salt, user.iterations);

      if (!Sec.safeEqual(hash, user.passwordHash)) {
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        let message = genericMessage;
        let detail = 'Kata sandi salah (percobaan ke-' + user.failedAttempts + ')';

        if (user.failedAttempts >= MAX_ATTEMPTS) {
          user.lockedUntil = Date.now() + LOCK_MS;
          user.failedAttempts = 0;
          detail = 'Kata sandi salah, akun diblokir 5 menit';
          message = 'Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.';
        }

        await DB.saveUser(user);
        await DB.logActivity({ userId: user.id, name: user.name, type: 'login_failed', detail: detail });
        showNotice('error', message);
        return;
      }

      user.failedAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = Date.now();
      await DB.saveUser(user);

      const lifetime = remember
        ? SESSION_REMEMBER_DAYS * 24 * 3600 * 1000
        : SESSION_HOURS * 3600 * 1000;

      Session.save({
        userId: user.id,
        name: user.name,
        token: Sec.createToken(),
        expiresAt: Date.now() + lifetime
      }, remember);

      await DB.logActivity({
        userId: user.id, name: user.name, type: 'login_success',
        detail: remember ? 'Masuk dengan opsi ingat saya' : 'Masuk'
      });

      window.location.replace('dashboard.html');
    } catch (error) {
      showNotice('error', error.message || 'Terjadi kesalahan saat masuk. Coba lagi.');
    } finally {
      setBusy(formLogin, false);
    }
  }

  /* ---------- Daftar ---------- */

  async function handleRegister(event) {
    event.preventDefault();
    hideNotice();
    clearErrors(formRegister);

    const name = Sec.normalizeName($('#reg-name').value);
    const password = $('#reg-password').value;

    let valid = true;
    const nameError = validateName(name);
    if (nameError) {
      setError('reg-name', nameError);
      valid = false;
    }
    if (password.length < 4) {
      setError('reg-password', 'Kata sandi minimal 4 karakter.');
      valid = false;
    }
    if (!valid) {
      focusFirstError(formRegister);
      return;
    }

    setBusy(formRegister, true, 'Membuat akun…');

    const duplicateMessage = 'Nama ini sudah dipakai. Gunakan nama lain, atau masuk jika itu akun Anda.';

    try {
      const existing = await DB.findUserByName(name);
      if (existing) {
        setError('reg-name', duplicateMessage);
        await DB.logActivity({ name: name, type: 'register_failed', detail: 'Nama sudah dipakai' });
        focusFirstError(formRegister);
        return;
      }

      const salt = Sec.createSalt();
      const passwordHash = await Sec.hashPassword(password, salt, Sec.ITERATIONS);

      const user = await DB.createUser({
        name: name,
        passwordHash: passwordHash,
        salt: salt,
        iterations: Sec.ITERATIONS
      });

      await DB.logActivity({
        userId: user.id, name: user.name, type: 'register_success', detail: 'Akun baru dibuat'
      });

      formRegister.reset();
      $('#login-name').value = name;
      $('#login-password').value = '';
      showForm('login', { keepNotice: true, focus: false });
      showNotice('success', 'Akun berhasil dibuat. Masukkan kata sandi Anda untuk masuk.');
      $('#login-password').focus();
    } catch (error) {
      if (error && error.code === 'NAME_EXISTS') {
        setError('reg-name', duplicateMessage);
        await DB.logActivity({ name: name, type: 'register_failed', detail: 'Nama sudah dipakai' });
        focusFirstError(formRegister);
      } else {
        showNotice('error', error.message || 'Terjadi kesalahan saat membuat akun. Coba lagi.');
      }
    } finally {
      setBusy(formRegister, false);
    }
  }

  /* ---------- Pasang event ---------- */

  tabLogin.addEventListener('click', function () { showForm('login', { log: true, focus: false }); });
  tabRegister.addEventListener('click', function () { showForm('register', { log: true, focus: false }); });

  document.querySelectorAll('[data-switch]').forEach(function (button) {
    button.addEventListener('click', function () {
      showForm(button.dataset.switch, { log: true });
    });
  });

  document.querySelector('.tabs').addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const goLogin = event.key === 'ArrowLeft';
    showForm(goLogin ? 'login' : 'register', { log: true, focus: 'tab' });
  });

  document.querySelectorAll('.toggle-pw').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = document.getElementById(button.dataset.toggle);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Sembunyikan' : 'Tampilkan';
      button.setAttribute('aria-pressed', String(show));
    });
  });

  formLogin.addEventListener('submit', handleLogin);
  formRegister.addEventListener('submit', handleRegister);

  boot();
})();
