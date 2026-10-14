document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const alertMessage = document.getElementById('alertMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // Toggle Password Visibility
    document.querySelectorAll('.togglePassword').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            const inputField = document.getElementById(targetId);
            const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
            inputField.setAttribute('type', type);
            e.target.classList.toggle('fa-eye');
            e.target.classList.toggle('fa-eye-slash');
        });
    });

    // Inisialisasi Data Pengguna di LocalStorage jika belum ada
    function initDatabase() {
        if (!localStorage.getItem('crm_users')) {
            const defaultUsers = [{
                name: 'Administrator',
                email: 'admin@crm.com',
                password: 'password123'
            }];
            localStorage.setItem('crm_users', JSON.stringify(defaultUsers));
        }
    }

    // Handle Registrasi (register.html)
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value.trim();

            if (password.length < 6) {
                showAlert('Kata sandi minimal harus 6 karakter.', 'error');
                return;
            }

            let users = JSON.parse(localStorage.getItem('crm_users')) || [];
            const existingUser = users.find(u => u.email === email);

            if (existingUser) {
                showAlert('Email sudah terdaftar. Gunakan email lain.', 'error');
                return;
            }

            users.push({ name, email, password });
            localStorage.setItem('crm_users', JSON.stringify(users));

            showAlert('Registrasi berhasil! Mengalihkan ke halaman masuk...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
        });
    }

    // Handle Login (index.html)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value.trim();

            let users = JSON.parse(localStorage.getItem('crm_users')) || [];
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                // Simpan sesi aktif
                localStorage.setItem('crm_active_session', JSON.stringify(user));
                showAlert(`Login Berhasil! Selamat datang, ${user.name}.`, 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showAlert('Email atau kata sandi salah. Silakan coba lagi.', 'error');
            }
        });
    }

    // Handle Halaman Dashboard (dashboard.html)
    if (window.location.pathname.includes('dashboard.html')) {
        const activeSession = JSON.parse(localStorage.getItem('crm_active_session'));
        
        // Proteksi Halaman Dashboard
        if (!activeSession) {
            window.location.href = 'index.html';
            return;
        }

        // Tampilkan Nama Pengguna dari Sesi Aktif
        const sessionUserName = document.getElementById('sessionUserName');
        const welcomeName = document.getElementById('welcomeName');
        const userAvatar = document.getElementById('userAvatar');

        if (sessionUserName) sessionUserName.textContent = activeSession.name;
        if (welcomeName) welcomeName.textContent = activeSession.name;
        if (userAvatar) userAvatar.textContent = activeSession.name.charAt(0).toUpperCase();
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('crm_active_session');
            window.location.href = 'index.html';
        });
    }

    function showAlert(message, type) {
        if (!alertMessage) return;
        alertMessage.textContent = message;
        alertMessage.className = `alert-message ${type}`;
        alertMessage.style.display = 'block';
    }

    initDatabase();
});
