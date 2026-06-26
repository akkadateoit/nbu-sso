var APP_ID    = 'demo';
var TOKEN_KEY = 'nbu_demo_token';
var _token    = null;

function decode(token) {
  try {
    var b64    = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var binary = atob(b64);
    var bytes  = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch (e) { return null; }
}

function isExpired(token) {
  var p = decode(token);
  return !p || Date.now() >= p.exp * 1000;
}

function expiryText(exp) {
  var ms = exp * 1000 - Date.now();
  if (ms <= 0) return 'หมดอายุแล้ว';
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return 'หมดอายุใน ' + h + 'ชม. ' + m + 'น.';
  return 'หมดอายุใน ' + m + ' นาที';
}

function loginWithSSO() {
  var cb = encodeURIComponent(window.location.origin + '/demouser');
  window.location.href = '/login?app_id=' + APP_ID + '&redirect_uri=' + cb;
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  window.location.href = '/demouser';
}

function toggleToken() {
  var el = document.getElementById('token-raw');
  if (el) el.classList.toggle('expanded');
}

function copyToken() {
  if (!_token) return;
  navigator.clipboard.writeText(_token).then(function () {
    var btn = document.querySelector('.btn-copy');
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> คัดลอกแล้ว!';
    btn.style.color = '#34d399';
    btn.style.borderColor = 'rgba(16,185,129,.35)';
    setTimeout(function () {
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> คัดลอก Token';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  });
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

function showProfile(payload, token) {
  _token = token;
  document.getElementById('login-view').style.display   = 'none';
  document.getElementById('profile-view').style.display = 'block';

  var name = payload.name || payload.email || '—';
  var perm = payload.permission || {};

  var avatarEl = document.getElementById('avatar-letter');
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  setText('p-name',     name);
  setText('p-email',    payload.email);
  setText('p2-name',    name);
  setText('p2-email',   payload.email);
  setText('p2-app',     payload.application_id);
  setText('p2-sub',     payload.sub);
  setText('p2-role',    perm.role);
  setText('p2-scope',   perm.scope_level);
  setText('p2-dept',    perm.allowed_dept_name);
  setText('p2-deptid',  perm.allowed_dept_id != null ? '#' + perm.allowed_dept_id : '—');
  setText('expiry-text', payload.exp ? expiryText(payload.exp) : '—');

  var tokenRaw = document.getElementById('token-raw');
  if (tokenRaw) tokenRaw.textContent = token;
}

window.onload = function () {
  // ── ผูก event listeners ทั้งหมด (ไม่ใช้ onclick ใน HTML เพราะ CSP บล็อก) ──
  var btnLogin  = document.querySelector('.btn-login');
  var tokenRaw  = document.getElementById('token-raw');
  var tokenHint = document.querySelector('.token-expand-hint');
  var btnCopy   = document.querySelector('.btn-copy');
  var btnLogout = document.querySelector('.btn-logout');

  if (btnLogin)  btnLogin.addEventListener('click', loginWithSSO);
  if (tokenRaw)  tokenRaw.addEventListener('click', toggleToken);
  if (tokenHint) tokenHint.addEventListener('click', toggleToken);
  if (btnCopy)   btnCopy.addEventListener('click', copyToken);
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // ── ตรวจ token ก่อนแสดง view (ป้องกัน flash of login screen) ──
  var params = new URLSearchParams(window.location.search);
  var token  = params.get('token');

  if (token) {
    history.replaceState({}, '', '/demouser');
    if (!isExpired(token)) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      token = null;
    }
  }

  if (!token) token = sessionStorage.getItem(TOKEN_KEY);

  // ซ่อน loading spinner
  var loadingEl = document.getElementById('loading-view');
  if (loadingEl) loadingEl.style.display = 'none';

  if (token && !isExpired(token)) {
    showProfile(decode(token), token);
  } else {
    // แสดง login view เมื่อรู้แน่ว่าไม่มี token
    document.getElementById('login-view').style.display = 'flex';
  }
};
