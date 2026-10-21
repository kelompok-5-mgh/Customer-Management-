# Relasi – Aplikasi Customer Management

Aplikasi pengelolaan pelanggan yang berjalan sepenuhnya di browser (HTML, CSS, JavaScript terpisah).

## Fitur

- Loading, masuk, dan daftar akun memakai **nama dan kata sandi** saja (sandi bebas, minimal 4 karakter)
- Dasbor: ringkasan pelanggan, grafik pelanggan baru, tindak lanjut terdekat, aktivitas terakhir
- Pelanggan: tambah, ubah, hapus, cari, filter status, dan urutkan
- **Detail pelanggan dan riwayat interaksi**: catat telepon, pesan, email, pertemuan, atau catatan, lengkap dengan tanggal tindak lanjut berikutnya
- Tindak lanjut: jadwal terlambat, hari ini, dan mendatang, dengan tombol "Selesai"
- **Laporan**: pelanggan baru, interaksi per bulan dan per jenis, status, kota teratas, pelanggan paling sering dihubungi, dan pelanggan yang perlu perhatian (periode 30 hari, 90 hari, atau 12 bulan; bisa dicetak)
- **Ekspor Excel** (.xlsx): lembar Ringkasan, Pelanggan, Interaksi, dan Aktivitas
- Aktivitas: semua kejadian akun tercatat di database
- Foto profil dan nama di pojok kanan atas, dengan menu ubah foto dan keluar
- Tampilan menyesuaikan HP dan desktop

## Struktur file

```
├── index.html          Loading, masuk, dan daftar
├── dashboard.html      Dasbor customer management
├── css/
│   ├── base.css        Warna, font, tombol, dan field
│   ├── auth.css        Loading, masuk, dan daftar
│   └── dashboard.css   Dasbor
└── js/
    ├── security.js     Hash kata sandi (PBKDF2) dan validasi
    ├── db.js           Database IndexedDB dan sesi
    ├── ui.js           Bantuan tampilan: elemen, ikon, tanggal, toast
    ├── auth.js         Alur loading, masuk, dan daftar
    ├── views.js        Dasbor, pelanggan, tindak lanjut, aktivitas, dialog pelanggan
    ├── detail.js       Detail pelanggan dan riwayat interaksi
    ├── reports.js      Halaman laporan
    ├── xlsx.js         Penulis file Excel (tanpa pustaka luar)
    ├── export.js       Menyusun data untuk ekspor Excel
    └── dashboard.js    Kerangka dasbor, profil, foto, navigasi
```

`index.html` dan `dashboard.html` harus berada di root repositori, sejajar dengan folder `css` dan `js`.

## Cara menjalankan

Buka `index.html` di browser, atau jalankan server lokal:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Tampilkan lewat GitHub Pages

1. Upload semua isi folder ini ke repositori GitHub (struktur folder harus tetap).
2. Buka **Settings → Pages**.
3. Pilih branch `main` dan folder `/ (root)`, lalu simpan.

## Database

Data disimpan di **IndexedDB** browser (`relasi_db`, versi 3):

| Tabel        | Isi                                                                  |
|--------------|----------------------------------------------------------------------|
| `users`      | Nama, hash kata sandi, foto profil, jumlah gagal masuk               |
| `customers`  | Data pelanggan milik tiap akun                                       |
| `interactions` | Riwayat interaksi per pelanggan (ikut terhapus bersama pelanggannya) |
| `activities` | Semua aktivitas: masuk, gagal masuk, tambah/ubah/hapus pelanggan, dll |

Akun dari versi sebelumnya (yang memakai email) otomatis dipindahkan: cukup masuk dengan nama yang dulu didaftarkan.

Catatan penting:

- Data tersimpan di browser masing-masing perangkat, bukan di server. Akun dan pelanggan yang dibuat di satu perangkat tidak muncul di perangkat lain.
- Menghapus data situs di browser ikut menghapus semua data ini.
- Untuk data bersama banyak pengguna dan perangkat, tahap berikutnya perlu backend (misalnya Supabase atau Firebase).

## Keamanan

- Sandi boleh sederhana, tetapi tetap disimpan sebagai hash PBKDF2-SHA256 dengan salt acak, bukan teks biasa.
- Akun diblokir 5 menit setelah 5 kali gagal masuk.
- Pesan gagal masuk tidak membocorkan apakah nama terdaftar.
- Sesi berlaku 8 jam, atau 30 hari jika memilih "Ingat saya".
