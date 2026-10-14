/* Relasi – database lokal (IndexedDB) dan sesi pengguna */
(function (global) {
  'use strict';

  const DB_NAME = 'relasi_db';
  const DB_VERSION = 1;
  const SESSION_KEY = 'relasi_session';

  let dbPromise = null;

  // Label dan warna untuk setiap jenis aktivitas
  const ACTIVITY_META = {
    app_open:         { label: 'Membuka aplikasi',          tone: 'neutral' },
    switch_form:      { label: 'Berpindah formulir',        tone: 'neutral' },
    register_success: { label: 'Akun dibuat',               tone: 'success' },
    register_failed:  { label: 'Pendaftaran gagal',         tone: 'danger' },
    login_success:    { label: 'Berhasil masuk',            tone: 'success' },
    login_failed:     { label: 'Gagal masuk',               tone: 'danger' },
    login_locked:     { label: 'Masuk diblokir sementara',  tone: 'danger' },
    logout:           { label: 'Keluar',                    tone: 'neutral' },
    dashboard_open:   { label: 'Membuka dasbor',            tone: 'neutral' }
  };

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('Browser ini tidak mendukung penyimpanan database lokal.'));
        return;
      }

      const request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function () {
        const db = request.result;

        if (!db.objectStoreNames.contains('users')) {
          const users = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          users.createIndex('email', 'email', { unique: true });
        }

        if (!db.objectStoreNames.contains('activities')) {
          const activities = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
          activities.createIndex('userId', 'userId');
          activities.createIndex('type', 'type');
          activities.createIndex('createdAt', 'createdAt');
        }
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () {
        reject(request.error || new Error('Database gagal dibuka.'));
      };
      request.onblocked = function () {
        reject(new Error('Database sedang dipakai tab lain. Tutup tab Relasi lainnya, lalu muat ulang.'));
      };
    });

    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  // Menjalankan satu operasi dalam satu transaksi
  function run(storeName, mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        const request = work(store);
        if (request) {
          request.onsuccess = function () { result = request.result; };
        }

        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transaksi database dibatalkan.')); };
      });
    });
  }

  /* ---------- Pengguna ---------- */

  function createUser(data) {
    const record = {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      salt: data.salt,
      iterations: data.iterations,
      createdAt: Date.now(),
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null
    };

    return run('users', 'readwrite', function (store) { return store.add(record); })
      .then(function (id) { return Object.assign({ id: id }, record); })
      .catch(function (error) {
        if (error && error.name === 'ConstraintError') {
          const duplicate = new Error('Email sudah terdaftar.');
          duplicate.code = 'EMAIL_EXISTS';
          throw duplicate;
        }
        throw error;
      });
  }

  function findUserByEmail(email) {
    return run('users', 'readonly', function (store) {
      return store.index('email').get(email);
    });
  }

  function getUserById(id) {
    return run('users', 'readonly', function (store) { return store.get(id); });
  }

  function saveUser(user) {
    return run('users', 'readwrite', function (store) { return store.put(user); });
  }

  /* ---------- Aktivitas ---------- */

  // Mencatat aktivitas. Tidak pernah melempar error agar tidak mengganggu alur utama.
  function logActivity(entry) {
    const record = {
      userId: entry.userId == null ? null : entry.userId,
      email: entry.email || null,
      type: entry.type,
      detail: entry.detail || '',
      page: (global.location.pathname.split('/').pop() || 'index.html'),
      userAgent: global.navigator.userAgent,
      createdAt: Date.now()
    };

    return run('activities', 'readwrite', function (store) { return store.add(record); })
      .catch(function (error) {
        console.warn('Aktivitas tidak tersimpan:', error);
      });
  }

  // Aktivitas milik satu pengguna, terbaru lebih dulu. limit 0 = semua.
  function listActivities(userId, limit) {
    return run('activities', 'readonly', function (store) {
      return store.index('userId').getAll(userId);
    }).then(function (rows) {
      rows = (rows || []).sort(function (a, b) { return b.createdAt - a.createdAt; });
      return limit ? rows.slice(0, limit) : rows;
    });
  }

  /* ---------- Sesi ---------- */

  const Session = {
    save: function (data, remember) {
      Session.clear();
      try {
        (remember ? global.localStorage : global.sessionStorage)
          .setItem(SESSION_KEY, JSON.stringify(data));
      } catch (error) {
        console.warn('Sesi tidak bisa disimpan:', error);
      }
    },

    get: function () {
      const stores = [global.sessionStorage, global.localStorage];
      for (let i = 0; i < stores.length; i++) {
        try {
          const raw = stores[i].getItem(SESSION_KEY);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data && data.expiresAt > Date.now()) return data;
          stores[i].removeItem(SESSION_KEY);
        } catch (error) {
          /* abaikan penyimpanan yang tidak tersedia */
        }
      }
      return null;
    },

    clear: function () {
      [global.sessionStorage, global.localStorage].forEach(function (storage) {
        try { storage.removeItem(SESSION_KEY); } catch (error) { /* abaikan */ }
      });
    }
  };

  global.RelasiDB = {
    open: open,
    createUser: createUser,
    findUserByEmail: findUserByEmail,
    getUserById: getUserById,
    saveUser: saveUser,
    logActivity: logActivity,
    listActivities: listActivities,
    ACTIVITY_META: ACTIVITY_META
  };
  global.RelasiSession = Session;
})(window);
