import { useQuery } from '@tanstack/react-query'
import { Package, Users, ShieldCheck, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

const actionLabel = {
  GRANT:       { label: 'เพิ่มสิทธิ์',  variant: 'success' },
  REVOKE:      { label: 'ลบสิทธิ์',    variant: 'destructive' },
  UPDATE:      { label: 'แก้ไขสิทธิ์', variant: 'secondary' },
  CREATE_APP:  { label: 'สร้างแอป',    variant: 'default' },
  DISABLE_APP: { label: 'ปิดแอป',      variant: 'warning' },
  DISABLE_USER:{ label: 'ปิด User',    variant: 'destructive' },
  ENABLE_USER: { label: 'เปิด User',   variant: 'success' },
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
  })

  const stats = data?.stats
  const logs  = data?.recentLogs || []

  const statCards = [
    { label: 'Apps ที่ใช้งาน', value: stats?.active_apps ?? '—', sub: `จากทั้งหมด ${stats?.total_apps ?? '—'} apps`,  icon: Package,     color: 'text-blue-600' },
    { label: 'Users ทั้งหมด',  value: stats?.active_users ?? '—', sub: `Active ${stats?.active_users ?? '—'} คน`,     icon: Users,       color: 'text-green-600' },
    { label: 'สิทธิ์ทั้งหมด', value: stats?.total_permissions ?? '—', sub: 'จากทุก App',                               icon: ShieldCheck, color: 'text-purple-600' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ</h1>
        <p className="text-muted-foreground text-sm mt-1">NBU Centralized SSO — Admin Dashboard</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-6">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? '...' : value}</div>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            กิจกรรมล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีกิจกรรม</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => {
                const info = actionLabel[log.action] || { label: log.action, variant: 'outline' }
                return (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <Badge variant={info.variant} className="mt-0.5 shrink-0">{info.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.acted_by_email}</span>
                        {log.target_email && <> → <span className="text-blue-600">{log.target_email}</span></>}
                        {log.app_name && <> ใน <span className="font-mono text-xs bg-slate-100 px-1 rounded">{log.app_name}</span></>}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: th })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
