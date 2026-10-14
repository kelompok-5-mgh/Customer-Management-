document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const errorMessage = document.getElementById('errorMessage');

    // Toggle Password Visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Toggle icon
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    // Handle Login Submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Reset error message
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        // Simple Validation (Simulasi)
        if (!email || !password) {
            showError('Mohon isi email dan kata sandi.');
            return;
        }

        // Contoh kredensial dummy untuk pengujian awal
        // Email: admin@crm.com, Password: password123
        if (email === 'admin@crm.com' && password === 'password123') {
            alert('Login Berhasil! Selamat datang di Customer Management System.');
            // Di sini Anda bisa mengarahkan ke halaman dashboard selanjutnya
            // window.location.href = 'dashboard.html';
        } else {
            showError('Email atau kata sandi salah. (Coba: admin@crm.com / password123)');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});
