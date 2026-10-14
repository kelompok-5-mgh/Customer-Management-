# Customer Management System (CRM) - Login & Register with Database Activity Log

Proyek aplikasi **Customer Management System (CRM)** dengan fitur Login, Pendaftaran (Registrasi) akun baru, serta Database simulasi berbasis *LocalStorage* untuk mencatat seluruh aktivitas aplikasi secara real-time.

## Struktur File
- `index.html` : Kerangka antarmuka Login, Registrasi, dan Panel Log Aktivitas Database.
- `style.css`  : Styling modern responsif dengan grid layout dan panel aktivitas gelap.
- `script.js`  : Logika autentikasi (Login & Register), penyimpanan ke database lokal, dan pencatatan log aktivitas.

## Fitur Utama
1. **Form Login & Pendaftaran (Tabbed Switch)**: Pengguna dapat beralih antara form Masuk dan Daftar dengan mudah.
2. **Validasi & Penyimpanan Data**: Akun baru yang didaftarkan tersimpan di basis data lokal browser (`LocalStorage`).
3. **Log Aktivitas Database Real-time**: Setiap aksi (pendaftaran, login berhasil, login gagal, pembersihan log) dicatat secara otomatis lengkap dengan stempel waktu dan statusnya.

## Kredensial Bawaan (Default Admin)
- **Email:** `admin@crm.com`
- **Password:** `password123`

## Cara Upload ke GitHub
1. Ekstrak file ZIP ini.
2. Upload file (`index.html`, `style.css`, `script.js`, `README.md`) ke repository GitHub Anda.
3. Aktifkan **GitHub Pages** di pengaturan repository untuk menjalankan aplikasi secara online.
