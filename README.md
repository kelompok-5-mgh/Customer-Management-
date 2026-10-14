# Relasi – Aplikasi Customer Management

Tahap 1: tampilan loading, masuk, daftar akun, dan database aktivitas.

## Struktur file

```
relasi/
├── index.html          Loading, masuk, dan daftar
├── dashboard.html      Dasbor sementara (log aktivitas)
├── css/
│   ├── base.css        Warna, font, tombol, dan field
│   ├── auth.css        Loading, masuk, dan daftar
│   └── dashboard.css   Dasbor
└── js/
    ├── security.js     Hash kata sandi (PBKDF2) dan validasi
    ├── db.js           Database IndexedDB dan sesi
    ├── auth.js         Alur loading, masuk, dan daftar
    └── dashboard.js    Cek sesi, tampilkan aktivitas, keluar
```

## Cara menjalankan

Buka `index.html` di browser, atau jalankan server lokal:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Upload ke GitHub dan tampilkan lewat GitHub Pages

1. Buat repositori baru di GitHub, lalu upload semua isi folder ini.
2. Buka **Settings → Pages**.
3. Pada **Branch**, pilih `main` dan folder `/ (root)`, lalu simpan.
4. Tunggu beberapa menit. Alamat situs muncul di halaman yang sama.

## Database

Data disimpan di **IndexedDB** milik browser (nama database `relasi_db`):

| Tabel        | Isi                                                                 |
|--------------|---------------------------------------------------------------------|
| `users`      | Nama, email, hash kata sandi, jumlah gagal masuk, waktu pembuatan   |
| `activities` | Semua aktivitas: buka aplikasi, daftar, masuk, gagal masuk, keluar  |

Catatan penting:

- Data tersimpan di browser masing-masing pengguna, bukan di server. Akun yang dibuat di satu perangkat tidak muncul di perangkat lain.
- Jika riwayat situs dihapus, data ikut terhapus.
- Untuk data bersama banyak pengguna, tahap berikutnya perlu backend dan database server (misalnya Supabase atau Firebase).

## Keamanan yang sudah ada

- Kata sandi tidak disimpan apa adanya. Disimpan sebagai hash PBKDF2-SHA256 dengan salt acak.
- Akun diblokir 5 menit setelah 5 kali gagal masuk.
- Pesan gagal masuk tidak membocorkan apakah email terdaftar.
- Sesi berlaku 8 jam, atau 30 hari jika memilih "Ingat saya".
