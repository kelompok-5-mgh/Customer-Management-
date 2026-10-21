/* Relasi – bantuan tampilan: pembuat elemen, ikon, format tanggal, toast */
(function (global) {
  'use strict';

  /* ---------- Pembuat elemen (aman dari XSS: teks selalu lewat textContent) ---------- */

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key.slice(0, 2) === 'on' && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, value);
      });
    }
    const children = Array.prototype.slice.call(arguments, 2);
    flatten(children).forEach(function (child) {
      if (child == null || child === false) return;
      el.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function flatten(list) {
    return list.reduce(function (all, item) {
      return all.concat(Array.isArray(item) ? flatten(item) : [item]);
    }, []);
  }

  /* ---------- Ikon ---------- */

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.7-3.1 3.1-4.6 6-4.6s5.3 1.5 6 4.6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.7.5 2.8 1.9 3.2 4.4"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5h4"/>',
    list: '<path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4" cy="6.5" r=".9"/><circle cx="4" cy="12" r=".9"/><circle cx="4" cy="17.5" r=".9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    logout: '<path d="M10 4.5H5.5v15H10M15 8l4 4-4 4M19 12H9.5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    inbox: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h5l1 2.5h4l1-2.5h5"/>',
    trend: '<path d="m4 16 5-5 3.5 3.5L20 7"/><path d="M15 7h5v5"/>',
    star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    phone: '<path d="M5 4.5h3.5L10 9l-2 1.3a11 11 0 0 0 5.7 5.7L15 14l4.5 1.5V19A1.5 1.5 0 0 1 18 20.5 14.5 14.5 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5z"/>',
    message: '<path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V7.5h4M9 12h6M9 16h6"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    print: '<path d="M7 9V4h10v5M7 17H4.5v-7h15v7H17M7 14h10v6H7z"/>',
    back: '<path d="m15 6-6 6 6 6"/>'
  };

  function icon(name, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size || 20);
    svg.setAttribute('height', size || 20);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  // Mengisi elemen statis bertanda data-icon di HTML
  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.replaceChildren(icon(el.dataset.icon, Number(el.dataset.size) || 20));
    });
  }

  /* ---------- Tanggal ---------- */

  const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateTimeFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short' });

  function pad(n) { return String(n).padStart(2, '0'); }

  function dayString(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayStr() { return dayString(new Date()); }

  function dayOffset(days) {
    const now = new Date();
    return dayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  }

  function parseDay(text) {
    const p = text.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function toLocalInput(ts) {
    const d = new Date(ts);
    return dayString(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function daysSince(ts) {
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function formatDay(text) { return text ? dayFormat.format(parseDay(text)) : ''; }
  function formatDateTime(ts) { return dateTimeFormat.format(new Date(ts)); }
  function formatMonth(date) { return monthFormat.format(date); }

  function dayDiff(text) {
    return Math.round((parseDay(text) - parseDay(todayStr())) / 86400000);
  }

  function relativeDay(text) {
    const d = dayDiff(text);
    if (d === 0) return 'Hari ini';
    if (d === 1) return 'Besok';
    if (d === -1) return 'Kemarin';
    return d > 1 ? d + ' hari lagi' : Math.abs(d) + ' hari lalu';
  }

  /* ---------- Avatar ---------- */

  function initials(name) {
    const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
  }

  function tone(name) {
    let sum = 0;
    const text = String(name || '');
    for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
    return sum % 4;
  }

  // Foto bila ada, jika tidak huruf awal nama
  function avatar(person, size) {
    const style = '--size:' + size + 'px';
    if (person.photo) {
      return h('img', { class: 'avatar', src: person.photo, alt: '', style: style });
    }
    return h('span', { class: 'avatar tone-' + tone(person.name), style: style, 'aria-hidden': 'true' }, initials(person.name));
  }

  /* ---------- Status pelanggan ---------- */

  const STATUS = {
    prospek:  { label: 'Prospek',     cls: 'chip-info' },
    aktif:    { label: 'Aktif',       cls: 'chip-ok' },
    nonaktif: { label: 'Tidak aktif', cls: 'chip-muted' }
  };

  /* ---------- Jenis interaksi ---------- */

  const INTERACTION = {
    telepon:   { label: 'Telepon',   icon: 'phone' },
    pesan:     { label: 'Pesan',     icon: 'message' },
    email:     { label: 'Email',     icon: 'mail' },
    pertemuan: { label: 'Pertemuan', icon: 'calendar' },
    catatan:   { label: 'Catatan',   icon: 'note' }
  };

  /* ---------- Toast ---------- */

  let toastTimer = null;

  function toast(message, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = 'toast' + (type === 'error' ? ' is-error' : '');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3800);
  }

  global.RelasiUI = {
    h: h,
    icon: icon,
    hydrateIcons: hydrateIcons,
    todayStr: todayStr,
    dayOffset: dayOffset,
    formatDay: formatDay,
    toLocalInput: toLocalInput,
    daysSince: daysSince,
    formatDateTime: formatDateTime,
    formatMonth: formatMonth,
    relativeDay: relativeDay,
    dayDiff: dayDiff,
    initials: initials,
    avatar: avatar,
    STATUS: STATUS,
    INTERACTION: INTERACTION,
    toast: toast
  };
})(window);
