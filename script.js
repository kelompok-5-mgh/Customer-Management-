document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const alertMessage = document.getElementById('alertMessage');
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

    // Inisialisasi Database Lokal (LocalStorage)
    function initDatabase() {
        if (!localStorage.getItem('crm_users')) {
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

    // Catat Aktivitas ke Database (LocalStorage)
    function logActivity(description, type = 'info') {
        const logs = JSON.parse(localStorage.getItem('crm_logs')) || [];
        const newLog = {
            time: new Date().toLocaleString('id-ID'),
            description: description,
            type: type
        };
        logs.unshift(newLog);
        localStorage.setItem('crm_logs', JSON.stringify(logs));
        renderLogs();
    }

    // Tampilkan Log di Panel Aktivitas
    function renderLogs() {
        if (!activityLogList) return;
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

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            localStorage.setItem('crm_logs', JSON.stringify([]));
            renderLogs();
            showAlert('Log aktivitas berhasil dibersihkan.', 'success');
        });
    }

    // Handle Registrasi (jika berada di halaman register.html)
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
                logActivity(`Gagal daftar: Email ${email} sudah terdaftar`, 'error');
                return;
            }

            users.push({
                name,
                email,
                password,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('crm_users', JSON.stringify(users));

            logActivity(`Pengguna baru terdaftar: ${name} (${email})`, 'success');
            showAlert('Registrasi berhasil! Mengalihkan ke halaman masuk...', 'success');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        });
    }

    // Handle Login (jika berada di halaman index.html)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value.trim();

            let users = JSON.parse(localStorage.getItem('crm_users')) || [];
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                logActivity(`Login berhasil oleh ${user.name} (${email})`, 'success');
                showAlert(`Login Berhasil! Selamat datang kembali, ${user.name}.`, 'success');
                
                localStorage.setItem('crm_active_session', JSON.stringify(user));

                setTimeout(() => {
                    alert(`Masuk ke Dashboard CRM untuk ${user.name} (Tahap berikutnya siap dikembangkan)`);
                }, 800);
            } else {
                logActivity(`Gagal login untuk email: ${email} (Kredensial salah)`, 'error');
                showAlert('Email atau kata sandi salah. Silakan periksa kembali.', 'error');
            }
        });
    }

    function showAlert(message, type) {
        if (!alertMessage) return;
        alertMessage.textContent = message;
        alertMessage.className = `alert-message ${type}`;
        alertMessage.style.display = 'block';
    }

    // Inisialisasi awal
    initDatabase();
    renderLogs();
});
