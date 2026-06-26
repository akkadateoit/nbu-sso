import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import api from '@/lib/api'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

const actionMeta = {
  GRANT:        { label: 'เพิ่มสิทธิ์',    variant: 'success' },
  REVOKE:       { label: 'ลบสิทธิ์',      variant: 'destructive' },
  UPDATE:       { label: 'แก้ไขสิทธิ์',   variant: 'secondary' },
  CREATE_APP:   { label: 'สร้างแอป',      variant: 'default' },
  UPDATE_APP:   { label: 'แก้ไขแอป',     variant: 'secondary' },
  DISABLE_APP:  { label: 'ปิดแอป',        variant: 'warning' },
  CREATE_USER:  { label: 'เพิ่ม User',    variant: 'success' },
  DELETE_USER:  { label: 'ลบ User',       variant: 'destructive' },
  DISABLE_USER: { label: 'ปิด User',      variant: 'destructive' },
  ENABLE_USER:  { label: 'เปิด User',     variant: 'success' },
  CREATE_ROLE:  { label: 'สร้าง Role',    variant: 'default' },
  CREATE_DEPT:  { label: 'สร้างหน่วยงาน', variant: 'default' },
}

// ── Pagination Component ───────────────────────────────────────
function Pagination({ page, totalPages, total, limit, onPageChange }) {
  // สร้างเลขหน้าที่จะแสดง (แสดงสูงสุด 5 หน้า)
  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = []
    const left  = Math.max(2, page - 2)
    const right = Math.min(totalPages - 1, page + 2)
    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between border-t px-6 py-4 bg-white rounded-b-xl">
      {/* ซ้าย: แสดง record range */}
      <p className="text-sm text-gray-500">
        แสดง <span className="font-medium text-gray-700">{from}–{to}</span> จาก <span className="font-medium text-gray-700">{total}</span> รายการ
      </p>

      {/* กลาง: page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page <= 1} onClick={() => onPageChange(1)} title="หน้าแรก">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        {/* Prev */}
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="ก่อนหน้า">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} className="px-2 text-gray-400 text-sm select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="icon"
              className={`h-8 w-8 text-sm ${p === page ? 'pointer-events-none' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}

        {/* Next */}
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="ถัดไป">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {/* Last page */}
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title="หน้าสุดท้าย">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ขวา: เลือกจำนวนต่อหน้า */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>แสดง</span>
        <Select value={String(limit)} onValueChange={v => { onPageChange(1, +v) }}>
          <SelectTrigger className="h-8 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 30, 50, 100].map(n => (
              <SelectItem key={n} value={String(n)}>{n} แถว</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>ต่อหน้า</span>
      </div>
    </div>
  )
}

// ── AuditLog Page ─────────────────────────────────────────────
export default function AuditLog() {
  const [page,  setPage]  = useState(1)
  const [limit, setLimit] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page, limit],
    queryFn:  () => api.get('/audit-logs', { params: { page, limit } }).then(r => r.data),
    keepPreviousData: true,
  })

  const logs       = data?.logs  || []
  const total      = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function handlePageChange(newPage, newLimit) {
    setPage(newPage)
    if (newLimit) setLimit(newLimit)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">ประวัติการเปลี่ยนแปลงสิทธิ์ทั้งหมด</p>
        </div>
        <div className="text-sm text-gray-500">
          ทั้งหมด <span className="font-semibold text-gray-800">{total}</span> รายการ
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">ยังไม่มีประวัติ</div>
          ) : (
            <div className="divide-y">
              {logs.map((log, i) => {
                const meta = actionMeta[log.action] || { label: log.action, variant: 'outline' }
                return (
                  <div key={log.id} className={`flex items-start gap-4 px-6 py-3.5 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                    <Badge variant={meta.variant} className="mt-0.5 shrink-0 w-[104px] justify-center text-xs">
                      {meta.label}
                    </Badge>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm">
                        <span className="font-medium text-gray-800">{log.acted_by_email}</span>
                        {log.target_email && (
                          <> <span className="text-gray-400 mx-1">→</span>
                          <span className="text-blue-600">{log.target_email}</span></>
                        )}
                      </p>
                      {(log.app_name || log.detail?.role_key) && (
                        <p className="text-xs text-gray-400">
                          {log.app_name && <>App: <code className="bg-slate-200 text-slate-700 px-1 rounded">{log.app_name}</code></>}
                          {log.detail?.role_key && <> · Role: <span className="font-medium text-gray-600">{log.detail.role_key}</span></>}
                          {log.detail?.scope_dept_id && <> · Scope ID: {log.detail.scope_dept_id}</>}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap pt-0.5">
                      {format(new Date(log.created_at), 'dd MMM yy · HH:mm', { locale: th })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination อยู่ที่ด้านล่างของ card เสมอ */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
