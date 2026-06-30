const TOKEN_KEY   = 'nbu_admin_token'
const LOGOUT_FLAG = 'nbu_admin_logged_out'
const SSO_URL     = ''   // same origin

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function decodeToken(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch { return null }
}

export function isTokenValid(token) {
  const p = decodeToken(token)
  if (!p) return false
  return Date.now() < p.exp * 1000
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  sessionStorage.removeItem(LOGOUT_FLAG) // ได้ token ใหม่ → ล้าง flag เสมอ
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedOut() {
  return sessionStorage.getItem(LOGOUT_FLAG) === '1'
}

// logout ต้องตั้ง flag กัน auto-redirect วนกลับเข้าระบบทันที
// (เคลียร์ JWT ของเราเองได้ แต่ session Google ฝั่ง browser ยังอยู่)
export function logout() {
  clearToken()
  sessionStorage.setItem(LOGOUT_FLAG, '1')
}

export function redirectToLogin() {
  const cb = encodeURIComponent(window.location.origin + '/admin/callback')
  window.location.href = `${SSO_URL}/login?app_id=sso-admin&redirect_uri=${cb}`
}

export function relogin() {
  sessionStorage.removeItem(LOGOUT_FLAG)
  redirectToLogin()
}

export function getCurrentUser() {
  const token = getToken()
  if (!token || !isTokenValid(token)) return null
  return decodeToken(token)
}
