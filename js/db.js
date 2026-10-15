/* Relasi – database lokal (IndexedDB) dan sesi pengguna */
(function (global) {
  'use strict';

  const DB_NAME = 'relasi_db';
  const DB_VERSION = 2;
  const SESSION_KEY = 'relasi_session';

  let dbPromise = null;

  // Label dan warna untuk setiap jenis aktivitas
  const ACTIVITY_META = {
    app_open:         { label: 'Membuka aplikasi',           tone: 'neutral' },
    switch_form:      { label: 'Berpindah formulir',         tone: 'neutral' },
    register_success: { label: 'Akun dibuat',                tone: 'success' },
    register_failed:  { label: 'Pendaftaran gagal',          tone: 'danger' },
    login_success:    { label: 'Berhasil masuk',             tone: 'success' },
    login_failed:     { label: 'Gagal masuk',                tone: 'danger' },
    login_locked:     { label: 'Masuk diblokir sementara',   tone: 'danger' },
    logout:           { label: 'Keluar',                     tone: 'neutral' },
    dashboard_open:   { label: 'Membuka dasbor',             tone: 'neutral' },
    customer_add:     { label: 'Pelanggan ditambahkan',      tone: 'success' },
    customer_edit:    { label: 'Pelanggan diubah',           tone: 'neutral' },
    customer_delete:  { label: 'Pelanggan dihapus',          tone: 'danger' },
    followup_done:    { label: 'Tindak lanjut selesai',      tone: 'success' },
    sample_data:      { label: 'Data contoh dimuat',         tone: 'neutral' },
    photo_update:     { label: 'Foto profil diperbarui',     tone: 'success' },
    photo_remove:     { label: 'Foto profil dihapus',        tone: 'neutral' }
  };

  function nameKey(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

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
        const tx = request.transaction;

        // Tabel pengguna: dari versi 1 (email) ke versi 2 (nama)
        const users = db.objectStoreNames.contains('users')
          ? tx.objectStore('users')
          : db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });

        if (users.indexNames.contains('email')) users.deleteIndex('email');

        if (!users.indexNames.contains('nameKey')) {
          users.createIndex('nameKey', 'nameKey', { unique: true });

          // Akun lama diberi kunci nama agar tetap bisa masuk memakai nama
          const seen = new Set();
          users.openCursor().onsuccess = function (event) {
            const cursor = event.target.result;
            if (!cursor) return;
            const user = cursor.value;
            let key = nameKey(user.name) || 'akun';
            if (seen.has(key)) key = key + '#' + user.id;
            seen.add(key);
            user.nameKey = key;
            if (!('photo' in user)) user.photo = null;
            cursor.update(user);
            cursor.continue();
          };
        }

        if (!db.objectStoreNames.contains('activities')) {
          const activities = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
          activities.createIndex('userId', 'userId');
          activities.createIndex('type', 'type');
          activities.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('customers')) {
          const customers = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
          customers.createIndex('userId', 'userId');
        }
      };

      request.onsuccess = function () {
        const db = request.result;
        // Jika tab lain memperbarui database, tutup koneksi ini agar tidak menghalangi
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
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
      nameKey: nameKey(data.name),
      passwordHash: data.passwordHash,
      salt: data.salt,
      iterations: data.iterations,
      photo: null,
      createdAt: Date.now(),
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null
    };

    return run('users', 'readwrite', function (store) { return store.add(record); })
      .then(function (id) { return Object.assign({ id: id }, record); })
      .catch(function (error) {
        if (error && error.name === 'ConstraintError') {
          const duplicate = new Error('Nama sudah dipakai.');
          duplicate.code = 'NAME_EXISTS';
          throw duplicate;
        }
        throw error;
      });
  }

  function findUserByName(name) {
    return run('users', 'readonly', function (store) {
      return store.index('nameKey').get(nameKey(name));
    });
  }

  function getUserById(id) {
    return run('users', 'readonly', function (store) { return store.get(id); });
  }

  function saveUser(user) {
    return run('users', 'readwrite', function (store) { return store.put(user); });
  }

  /* ---------- Pelanggan ---------- */

  function cleanCustomer(data) {
    return {
      name: data.name || '',
      company: data.company || '',
      phone: data.phone || '',
      email: data.email || '',
      city: data.city || '',
      status: data.status || 'prospek',
      followUpDate: data.followUpDate || '',
      notes: data.notes || ''
    };
  }

  function addCustomer(userId, data) {
    const now = Date.now();
    const record = Object.assign(cleanCustomer(data), {
      userId: userId,
      createdAt: data.createdAt || now,
      updatedAt: now
    });
    return run('customers', 'readwrite', function (store) { return store.add(record); })
      .then(function (id) { return Object.assign({ id: id }, record); });
  }

  function addCustomers(userId, list) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('customers', 'readwrite');
        const store = tx.objectStore('customers');
        const now = Date.now();
        list.forEach(function (data) {
          store.add(Object.assign(cleanCustomer(data), {
            userId: userId,
            createdAt: data.createdAt || now,
            updatedAt: now
          }));
        });
        tx.oncomplete = function () { resolve(list.length); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transaksi database dibatalkan.')); };
      });
    });
  }

  function updateCustomer(customer) {
    const record = Object.assign({}, customer, { updatedAt: Date.now() });
    return run('customers', 'readwrite', function (store) { return store.put(record); })
      .then(function () { return record; });
  }

  function deleteCustomer(id) {
    return run('customers', 'readwrite', function (store) { return store.delete(id); });
  }

  function listCustomers(userId) {
    return run('customers', 'readonly', function (store) {
      return store.index('userId').getAll(userId);
    }).then(function (rows) { return rows || []; });
  }

  /* ---------- Aktivitas ---------- */

  // Mencatat aktivitas. Tidak pernah melempar error agar tidak mengganggu alur utama.
  function logActivity(entry) {
    const record = {
      userId: entry.userId == null ? null : entry.userId,
      userName: entry.name || null,
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
    findUserByName: findUserByName,
    getUserById: getUserById,
    saveUser: saveUser,
    addCustomer: addCustomer,
    addCustomers: addCustomers,
    updateCustomer: updateCustomer,
    deleteCustomer: deleteCustomer,
    listCustomers: listCustomers,
    logActivity: logActivity,
    listActivities: listActivities,
    ACTIVITY_META: ACTIVITY_META
  };
  global.RelasiSession = Session;
})(window);
