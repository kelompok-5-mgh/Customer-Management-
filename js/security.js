/* Relasi – keamanan kata sandi dan validasi input */
(function (global) {
  'use strict';

  const ITERATIONS = 150000;
  const encoder = new TextEncoder();

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function ensureCrypto() {
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error('Browser ini belum bisa mengamankan kata sandi. Buka aplikasi lewat HTTPS atau localhost.');
    }
  }

  function createSalt() {
    ensureCrypto();
    return toBase64(global.crypto.getRandomValues(new Uint8Array(16)));
  }

  function createToken() {
    ensureCrypto();
    return toBase64(global.crypto.getRandomValues(new Uint8Array(24))).replace(/[+/=]/g, '');
  }

  async function hashPassword(password, saltBase64, iterations) {
    ensureCrypto();
    const key = await global.crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await global.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromBase64(saltBase64), iterations: iterations || ITERATIONS, hash: 'SHA-256' },
      key,
      256
    );
    return toBase64(bits);
  }

  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  // 0 = kosong, 1 = lemah, 2 = cukup, 3 = kuat
  function scorePassword(password) {
    if (!password) return 0;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 8 || !(hasLetter && hasDigit)) return 1;
    const extra = /[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password));
    return password.length >= 12 || extra ? 3 : 2;
  }

  global.RelasiSecurity = {
    ITERATIONS,
    createSalt,
    createToken,
    hashPassword,
    safeEqual,
    normalizeEmail,
    isEmail,
    scorePassword
  };
})(window);
