/* =========================================================
   CONFIG
   ---------------------------------------------------------
   Mot de passe admin (change-le !)
   ========================================================= */
const ADMIN_PASSWORD = "zryi2424"; // ← à changer

/* =========================================================
   STORAGE
   ========================================================= */
const LS = { keys: 'ka_keys', hwids: 'ka_hwids', logs: 'ka_logs' };
const load = (k, d) => JSON.parse(localStorage.getItem(k) || d);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let keys  = load(LS.keys,  []);
let hwids = load(LS.hwids, []);
let logs  = load(LS.logs,  []);

const persist = () => {
  save(LS.keys, keys);
  save(LS.hwids, hwids);
  save(LS.logs, logs);
};

/* =========================================================
   UTILS
   ========================================================= */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const uid = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = () => Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  return `${b()}-${b()}-${b()}`;
};

const fmtDate = ts => new Date(ts).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

const fmtLeft = ms => {
  if (ms <= 0) return '—';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  }, 2600);
};

const addLog = (type, detail) => {
  logs.unshift({ ts: Date.now(), type, detail });
  if (logs.length > 500) logs.pop();
  persist();
  renderLogs();
};

/* =========================================================
   LOGIN
   ========================================================= */
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const pass = $('#loginPass').value;
  if (pass === ADMIN_PASSWORD) {
    sessionStorage.setItem('ka_logged', '1');
    showApp();
  } else {
    $('#loginError').hidden = false;
    $('#loginPass').value = '';
  }
});

$('#btnLogout').addEventListener('click', () => {
  sessionStorage.removeItem('ka_logged');
  location.reload();
});

function showApp() {
  $('#loginScreen').hidden = true;
  $('#app').hidden = false;
  renderKeys();
  renderHwids();
  renderLogs();
}

if (sessionStorage.getItem('ka_logged') === '1') showApp();

/* =========================================================
   NAV
   ========================================================= */
const viewTitles = { keys: 'Licences', hwid: 'HWID Blacklist', logs: 'Logs' };

$$('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n === item));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    $('#pageTitle').textContent = viewTitles[view] || '';
  });
});

/* =========================================================
   STATUS
   ========================================================= */
function computeStatus(k) {
  if (k.banned) return 'banned';
  if (Date.now() > k.expiresAt) return 'expired';
  return 'active';
}

function renderStats() {
  let active = 0, expired = 0, banned = 0;
  keys.forEach(k => {
    const s = computeStatus(k);
    if (s === 'active') active++;
    else if (s === 'expired') expired++;
    else banned++;
  });
  $('#statTotal').textContent = keys.length;
  $('#statActive').textContent = active;
  $('#statExpired').textContent = expired;
  $('#statBanned').textContent = banned;
}

/* =========================================================
   RENDER KEYS
   ========================================================= */
function renderKeys() {
  const q  = $('#filterKeys').value.trim().toUpperCase();
  const fs = $('#filterStatus').value;

  const list = keys.filter(k => {
    const s = computeStatus(k);
    if (fs && s !== fs) return false;
    if (q) {
      const inKey  = k.key.includes(q);
      const inHwid = k.hwid && k.hwid.toUpperCase().includes(q);
      if (!inKey && !inHwid) return false;
    }
    return true;
  });

  const tbody = $('#keysBody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    $('#keysEmpty').hidden = false;
    renderStats();
    return;
  }
  $('#keysEmpty').hidden = true;

  list.forEach(k => {
    const s    = computeStatus(k);
    const left = s === 'active' ? fmtLeft(k.expiresAt - Date.now()) : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="key-mono" data-copy="${k.key}">${k.key}</span></td>
      <td><span class="badge ${s}">${s}</span></td>
      <td class="text-dim">${k.days}j</td>
      <td>${k.hwid
        ? `<span class="hwid-mono">${k.hwid}</span>`
        : `<span class="hwid-mono empty">libre</span>`}</td>
      <td class="text-dim">${fmtDate(k.expiresAt)}</td>
      <td class="text-mute">${left}</td>
      <td>
        <div class="row-actions">
          ${k.banned
            ? `<button class="btn btn-ghost btn-small" data-act="unban" data-key="${k.key}">Déban</button>`
            : `<button class="btn btn-ghost btn-small" data-act="ban" data-key="${k.key}">Ban</button>`}
          <button class="btn btn-ghost btn-small" data-act="del" data-key="${k.key}">Suppr.</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-copy]').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard?.writeText(el.dataset.copy).then(() => toast('Clé copiée', 'success'));
    });
  });
  tbody.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const act = btn.dataset.act;
      if (act === 'ban')   return banKey(key);
      if (act === 'unban') return unbanKey(key);
      if (act === 'del')   return deleteKey(key);
    });
  });

  renderStats();
}

function banKey(key) {
  const k = keys.find(x => x.key === key);
  if (!k) return;
  k.banned = true;
  persist();
  renderKeys();
  addLog('ban', `Clé bannie : ${key}`);
  toast('Clé bannie', 'error');
}
function unbanKey(key) {
  const k = keys.find(x => x.key === key);
  if (!k) return;
  k.banned = false;
  persist();
  renderKeys();
  addLog('unban', `Clé réactivée : ${key}`);
  toast('Clé réactivée', 'success');
}
function deleteKey(key) {
  if (!confirm(`Supprimer la clé ${key} ?`)) return;
  keys = keys.filter(k => k.key !== key);
  persist();
  renderKeys();
  addLog('delete', `Clé supprimée : ${key}`);
  toast('Clé supprimée', 'info');
}

/* =========================================================
   HWID
   ========================================================= */
function renderHwids() {
  const tbody = $('#hwidBody');
  tbody.innerHTML = '';

  if (hwids.length === 0) {
    $('#hwidEmpty').hidden = false;
    return;
  }
  $('#hwidEmpty').hidden = true;

  hwids.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="hwid-mono">${h.hwid}</span></td>
      <td class="text-dim">${fmtDate(h.ts)}</td>
      <td><button class="btn btn-ghost btn-small">Retirer</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => removeHwid(h.hwid));
    tbody.appendChild(tr);
  });
}

function banHwid() {
  const input = $('#newHwid');
  const v = input.value.trim().toUpperCase();
  if (!v) return toast('Entrez un HWID', 'error');
  if (hwids.some(h => h.hwid === v)) return toast('Déjà banni', 'error');
  hwids.unshift({ hwid: v, ts: Date.now() });
  input.value = '';
  persist();
  renderHwids();
  addLog('hwid-ban', `HWID banni : ${v}`);
  toast('HWID banni', 'error');
}

function removeHwid(hwid) {
  hwids = hwids.filter(h => h.hwid !== hwid);
  persist();
  renderHwids();
  addLog('hwid-unban', `HWID retiré : ${hwid}`);
  toast('HWID retiré', 'success');
}

/* =========================================================
   LOGS
   ========================================================= */
function renderLogs() {
  const tbody = $('#logsBody');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    $('#logsEmpty').hidden = false;
    return;
  }
  $('#logsEmpty').hidden = true;

  const labels = {
    create:       ['Création',    'active'],
    ban:          ['Ban',         'banned'],
    unban:        ['Déban',       'active'],
    delete:       ['Suppression', 'expired'],
    'hwid-ban':   ['HWID+',       'banned'],
    'hwid-unban': ['HWID-',       'active'],
    export:       ['Export',      'active']
  };

  logs.forEach(l => {
    const [label, cls] = labels[l.type] || [l.type, 'active'];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-dim">${fmtDate(l.ts)}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td>${l.detail}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================================================
   MODAL
   ========================================================= */
const modal = $('#modalKey');
let selectedDays = 30;

const openModal  = () => modal.hidden = false;
const closeModal = () => modal.hidden = true;

$$('[data-close]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('#btnNewKey').addEventListener('click', openModal);

$$('#durationChips .chip').forEach(c => {
  c.addEventListener('click', () => {
    $$('#durationChips .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    selectedDays = parseInt(c.dataset.days, 10);
  });
});

$('#btnConfirmKey').addEventListener('click', () => {
  const qty  = Math.max(1, Math.min(100, parseInt($('#keyQty').value, 10) || 1));
  const hwid = $('#keyHwid').value.trim().toUpperCase() || null;
  const now  = Date.now();
  const created = [];

  for (let i = 0; i < qty; i++) {
    let key;
    do { key = uid(); } while (keys.some(k => k.key === key));
    const obj = {
      key,
      days: selectedDays,
      hwid,
      createdAt: now,
      expiresAt: now + selectedDays * 86400000,
      banned: false
    };
    keys.unshift(obj);
    created.push(key);
  }

  persist();
  renderKeys();
  addLog('create', `${qty} clé(s) ${selectedDays}j${hwid ? ' · HWID ' + hwid : ''}`);
  toast(`${qty} clé(s) générée(s)`, 'success');
  closeModal();

  if (created.length === 1) navigator.clipboard?.writeText(created[0]).catch(() => {});
});

/* =========================================================
   EXPORT
   ========================================================= */
$('#btnExport').addEventListener('click', () => {
  if (keys.length === 0) return toast('Aucune clé à exporter', 'error');
  const lines = keys.map(k => {
    const s = computeStatus(k);
    return [k.key, s, `${k.days}j`, k.hwid || '-', new Date(k.expiresAt).toISOString()].join(' | ');
  });
  const csv = 'key|status|days|hwid|expires\n' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keys_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  addLog('export', `${keys.length} clé(s) exportée(s)`);
  toast('Export téléchargé', 'success');
});

/* =========================================================
   EVENTS
   ========================================================= */
$('#filterKeys').addEventListener('input', renderKeys);
$('#filterStatus').addEventListener('change', renderKeys);
$('#btnBanHwid').addEventListener('click', banHwid);
$('#newHwid').addEventListener('keydown', e => { if (e.key === 'Enter') banHwid(); });

$('#btnClearLogs').addEventListener('click', () => {
  if (!confirm('Effacer tous les logs ?')) return;
  logs = [];
  persist();
  renderLogs();
  toast('Logs effacés', 'info');
});