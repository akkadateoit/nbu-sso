import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1/admin' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nbu_admin_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nbu_admin_token')
      window.location.href = `/login?app_id=sso-admin&redirect_uri=${encodeURIComponent(window.location.origin + '/admin/callback')}`
    }
    return Promise.reject(err)
  }
)

export default api
