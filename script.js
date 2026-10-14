document.addEventListener('DOMContentLoaded', () => {
    // Tab Elements
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const alertMessage = document.getElementById('alertMessage');

    // Input Elements
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const regName = document.getElementById('regName');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');

    // Activity Log Elements
    const activityLogList = document.getElementById('activityLogList');
    const clearLogsBtn = document.getElementById('clearLogs');

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

    // Switch Tabs
    loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        loginForm.classList.add('active-form');
        registerForm.classList.remove('active-form');
        hideAlert();
    });

    registerTabBtn.addEventListener('click', () => {
        registerTabBtn.classList.add('active');
        loginTabBtn.classList.remove('active');
        registerForm.classList.add('active-form');
        loginForm.classList.remove('active-form');
        hideAlert();
    });

    // Inisialisasi Database Lokal (LocalStorage)
    function initDatabase() {
        if (!localStorage.getItem('crm_users')) {
            // Default admin account
            const defaultUsers = [{
                name: 'Administrator',
                email: 'admin@crm.com',
                password: 'password123',
                createdAt: new Date().toISOString()
            }];
            localStorage.setItem('crm_users', JSON.stringify(defaultUsers));
        }
        if (!localStorage.getItem('crm_logs')) {
            localStorage.setItem('crm_logs', JSON.stringify([]));
        }
    }

    // Catat Aktivitas ke "Database" (LocalStorage)
    function logActivity(description, type = 'info') {
        const logs = JSON.parse(localStorage.getItem('crm_logs')) || [];
        const newLog = {
            time: new Date().toLocaleString('id-ID'),
            description: description,
            type: type
        };
        logs.unshift(newLog); // Tambahkan ke urutan paling atas
        localStorage.setItem('crm_logs', JSON.stringify(logs));
        renderLogs();
    }

    // Tampilkan Log di Panel Aktivitas
    function renderLogs() {
        const logs = JSON.parse(localStorage.getItem('crm_logs')) || [];
        activityLogList.innerHTML = '';
        if (logs.length === 0) {
            activityLogList.innerHTML = '<li class="activity-item"><span class="activity-time">-</span><span class="activity-desc">Belum ada aktivitas tercatat.</span></li>';
            return;
        }
        logs.forEach(log => {
            const li = document.createElement('li');
            li.className = `activity-item ${log.type}`;
            li.innerHTML = `
                <span class="activity-time"><i class="fa-regular fa-clock"></i> ${log.time}</span>
                <span class="activity-desc">${log.description}</span>
            `;
            activityLogList.appendChild(li);
        });
    }

    // Bersihkan Log
    clearLogsBtn.addEventListener('click', () => {
        localStorage.setItem('crm_logs', JSON.stringify([]));
        renderLogs();
        showAlert('Log aktivitas berhasil dibersihkan.', 'success');
    });

    // Handle Registrasi
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = regName.value.trim();
        const email = regEmail.value.trim();
        const password = regPassword.value.trim();

        if (password.length < 6) {
            showAlert('Kata sandi minimal harus 6 karakter.', 'error');
            return;
        }

        let users = JSON.parse(localStorage.getItem('crm_users')) || [];
        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            showAlert('Email sudah terdaftar. Silakan gunakan email lain atau masuk.', 'error');
            logActivity(`Gagal daftar: Email ${email} sudah terdaftar`, 'error');
            return;
        }

        // Simpan user baru
        users.push({
            name,
            email,
            password,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem('crm_users', JSON.stringify(users));

        logActivity(`Pengguna baru terdaftar: ${name} (${email})`, 'success');
        showAlert('Registrasi berhasil! Silakan masuk menggunakan akun Anda.', 'success');
        
        // Reset form & pindah ke tab login
        registerForm.reset();
        setTimeout(() => {
            loginTabBtn.click();
        }, 1500);
    });

    // Handle Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();

        let users = JSON.parse(localStorage.getItem('crm_users')) || [];
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            logActivity(`Login berhasil oleh ${user.name} (${email})`, 'success');
            showAlert(`Login Berhasil! Selamat datang kembali, ${user.name}.`, 'success');
            
            // Simulasi sesi aktif
            localStorage.setItem('crm_active_session', JSON.stringify(user));

            // Di sini nanti bisa diarahkan ke dashboard.html tahap berikutnya
            setTimeout(() => {
                alert(`Masuk ke Dashboard CRM untuk ${user.name} (Tahap selanjutnya siap dikembangkan)`);
            }, 800);
        } else {
            logActivity(`Gagal login untuk email: ${email} (Kredensial salah)`, 'error');
            showAlert('Email atau kata sandi salah. Silakan periksa kembali.', 'error');
        }
    });

    function showAlert(message, type) {
        alertMessage.textContent = message;
        alertMessage.className = `alert-message ${type}`;
        alertMessage.style.display = 'block';
    }

    function hideAlert() {
        alertMessage.style.display = 'none';
    }

    // Jalankan inisialisasi saat pertama kali
    initDatabase();
    logActivity('Sistem CRM berhasil dimuat & database lokal siap.', 'info');
    renderLogs();
});
