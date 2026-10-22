// Shared helpers for every Request Hub page.
(function () {
  const cfg = window.APP_CONFIG || { API_BASE: '' };
  const svg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
    eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    home: svg('<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'),
    doc: svg('<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>'),
    check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'),
    logout: svg('<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>'),
  };
  const ROLE_LABELS = {
    employee: 'Employee', supervisor: 'Supervisor', manager: 'Manager', hr: 'HR', accounting: 'Accounting',
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function api(path, opts = {}) {
    const res = await fetch(cfg.API_BASE + '/api' + path, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.message || 'Something went wrong. Try again.');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }

  /* Theme: dark by default, switch to light with the toggle */
  const getTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  function syncToggles() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      const dark = getTheme() === 'dark';
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
      btn.setAttribute('aria-label', label);
      btn.title = label;
    });
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('rh-theme', theme); } catch (e) { /* storage blocked */ }
    syncToggles();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });

  /* Show/hide password button inside the field */
  function addEye(input) {
    const wrap = input.parentElement;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eye';
    btn.innerHTML = ICONS.eye;
    btn.setAttribute('aria-label', 'Show password');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    wrap.appendChild(btn);
  }

  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = 'msg' + (kind ? ' ' + kind : '');
    el.hidden = false;
  }

  /* Page guard: returns the logged-in user, or sends the person to log in */
  const never = () => new Promise(() => {});
  async function requireUser(opts = {}) {
    let user;
    try {
      user = (await api('/auth/me')).user;
    } catch (e) {
      location.replace('/login.html');
      return never();
    }
    if (user.mustChangePassword && !opts.allowMustChange) {
      location.replace('/change-password.html');
      return never();
    }
    if (opts.roles && !opts.roles.includes(user.role)) {
      location.replace('/dashboard.html');
      return never();
    }
    return user;
  }

  /* The same layout on every signed-in page */
  function renderShell(user, active) {
    const nav = [{ id: 'dashboard', label: 'Dashboard', href: '/dashboard.html', icon: 'home' }];
    if (['supervisor', 'manager', 'hr'].includes(user.role)) nav.push({ id: 'approvals', label: 'Approvals', href: '/approvals.html', icon: 'check' });
    if (user.role !== 'accounting') nav.push({ id: 'requests', label: 'My Requests', href: '/requests.html', icon: 'doc' });
    if (['hr', 'accounting'].includes(user.role)) nav.push({ id: 'recent', label: 'Recent', href: '/recent.html', icon: 'clock' });
    if (user.role === 'hr') nav.push({ id: 'users', label: 'Users', href: '/users.html', icon: 'users' });
    nav.push({ id: 'settings', label: 'Settings', icon: 'gear', soon: true });

    const links = nav.map((n) => (n.soon
      ? `<span class="nav-item" aria-disabled="true" title="Coming in a later phase">${ICONS[n.icon]}${esc(n.label)}<span class="nav-soon">Soon</span></span>`
      : `<a class="nav-item${n.id === active ? ' active' : ''}" href="${n.href}"${n.id === active ? ' aria-current="page"' : ''}>${ICONS[n.icon]}${esc(n.label)}</a>`
    )).join('');

    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="side">
          <a class="side-brand" href="/dashboard.html">
            <span class="logo-chip"><img src="/img/logo.png" alt="Steniel Graham Packaging Philippines Corporation"></span>
            <span class="side-name">Request Hub</span>
          </a>
          <nav class="side-nav" aria-label="Main">${links}</nav>
        </aside>
        <div class="content">
          <header class="top">
            <h1 id="page-title"></h1>
            <div class="top-right">
              <span class="who"><strong>${esc(user.fullName)}</strong><small>${esc(ROLE_LABELS[user.role] || '')}</small></span>
              <button type="button" class="icon-btn" data-theme-toggle></button>
              <button type="button" class="icon-btn" id="logout-btn" aria-label="Log out" title="Log out">${ICONS.logout}</button>
            </div>
          </header>
          <main id="main"></main>
        </div>
      </div>`;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* leave anyway */ }
      location.replace('/login.html');
    });
    syncToggles();
    return {
      main: document.getElementById('main'),
      setTitle(t) { document.getElementById('page-title').textContent = t; document.title = t + ' · Request Hub'; },
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncToggles();
    document.querySelectorAll('input[data-eye]').forEach(addEye);
  });

  /* Request lists */
  const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
  const statusBadge = (s) => '<span class="badge ' + esc(s) + '">' + esc(STATUS_LABELS[s] || s) + '</span>';
  const fmtDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDateTime = (v) => new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  function requestTable(list, opts = {}) {
    if (!list.length) return '<p class="empty">' + esc(opts.empty || 'Nothing here yet.') + '</p>';
    return '<div class="table-wrap"><table class="table req-table"><thead><tr><th>Ref</th><th>Form</th><th>Details</th>' +
      (opts.showRequester ? '<th>Requester</th>' : '') + '<th>Status</th><th>Filed</th></tr></thead><tbody>' +
      list.map((r) => '<tr><td><a href="/request.html?id=' + esc(r.id) + '">' + esc(r.refNo) + '</a></td>' +
        '<td>' + esc(r.label) + '</td><td>' + esc(r.summary) + '</td>' +
        (opts.showRequester ? '<td>' + esc(r.requester.name) + '</td>' : '') +
        '<td>' + statusBadge(r.status) + '</td><td>' + esc(fmtDate(r.createdAt)) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  /* Live updates: the server says "something changed", the page reloads just that data.
     If the connection drops, show a note and check every few seconds until it returns. */
  function live(refresh) {
    let bar = null; let pollTimer = null; let debounce = null; let wasDown = false;
    const run = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { Promise.resolve(refresh()).catch(() => {}); }, 150);
    };
    const showBar = () => {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'live-bar';
        bar.setAttribute('role', 'status');
        bar.textContent = 'Reconnecting… updates may be a few seconds late.';
        document.body.appendChild(bar);
      }
      bar.hidden = false;
    };
    const startPoll = () => { if (!pollTimer) pollTimer = setInterval(run, 5000); };
    const stopPoll = () => { clearInterval(pollTimer); pollTimer = null; };
    if (typeof io === 'undefined') { showBar(); startPoll(); return; }
    const socket = io();
    socket.on('connect', () => { if (bar) bar.hidden = true; stopPoll(); if (wasDown) run(); });
    const down = () => { wasDown = true; showBar(); startPoll(); };
    socket.on('disconnect', down);
    socket.on('connect_error', down);
    socket.on('request:changed', run);
    socket.on('users:changed', run);
  }

  window.RH = {
    api, esc, requireUser, renderShell, showMsg, ROLE_LABELS, ICONS,
    statusBadge, requestTable, fmtDate, fmtDateTime, live,
  };
})();
