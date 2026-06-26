import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

const actionMeta = {
  GRANT:        { label: 'เพิ่มสิทธิ์',  variant: 'success' },
  REVOKE:       { label: 'ลบสิทธิ์',    variant: 'destructive' },
  UPDATE:       { label: 'แก้ไขสิทธิ์', variant: 'secondary' },
  CREATE_APP:   { label: 'สร้างแอป',    variant: 'default' },
  UPDATE_APP:   { label: 'แก้ไขแอป',   variant: 'secondary' },
  DISABLE_APP:  { label: 'ปิดแอป',      variant: 'warning' },
  DISABLE_USER: { label: 'ปิด User',    variant: 'destructive' },
  ENABLE_USER:  { label: 'เปิด User',   variant: 'success' },
}

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const limit = 30

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page],
    queryFn: () => api.get('/audit-logs', { params: { page, limit } }).then(r => r.data),
  })

  const logs      = data?.logs  || []
  const total     = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">ประวัติการเปลี่ยนแปลงสิทธิ์ทั้งหมด</p>
        </div>
        <div className="text-sm text-muted-foreground">ทั้งหมด {total} รายการ</div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">ยังไม่มีประวัติ</div>
          ) : (
            <div className="divide-y">
              {logs.map((log, i) => {
                const meta = actionMeta[log.action] || { label: log.action, variant: 'outline' }
                return (
                  <div key={log.id} className={`flex items-start gap-4 px-6 py-4 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                    <Badge variant={meta.variant} className="mt-0.5 shrink-0 w-24 justify-center">
                      {meta.label}
                    </Badge>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{log.acted_by_email}</span>
                        {log.target_email && (
                          <> → <span className="text-blue-600">{log.target_email}</span></>
                        )}
                      </p>
                      {log.app_name && (
                        <p className="text-xs text-muted-foreground">
                          App: <code className="bg-slate-200 px-1 rounded">{log.app_name}</code>
                          {log.detail?.role_key && <> · Role: <span className="font-medium">{log.detail.role_key}</span></>}
                          {log.detail?.role_before && <> · {log.detail.role_before} → {log.detail.role_after}</>}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: th })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />ก่อนหน้า
          </Button>
          <span className="text-sm text-muted-foreground">หน้า {page} จาก {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            ถัดไป<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
