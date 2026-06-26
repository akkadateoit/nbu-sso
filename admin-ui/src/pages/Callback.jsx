import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveToken, decodeToken, isTokenValid } from '@/lib/auth'

export default function Callback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')

    if (token && isTokenValid(token)) {
      const payload = decodeToken(token)
      if (payload?.permission?.role === 'ADMIN' && payload?.application_id === 'sso-admin') {
        saveToken(token)
        navigate('/', { replace: true })
      } else {
        navigate('/forbidden', { replace: true })
      }
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">กำลังเข้าสู่ระบบ...</p>
    </div>
  )
}
