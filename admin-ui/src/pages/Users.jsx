import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp, Plus, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'

// ── Grant Permission Dialog ───────────────────────────────────
function GrantDialog({ user, onDone }) {
  const [open, setOpen] = useState(false)
  const [appId,    setAppId]    = useState('')
  const [roleKey,  setRoleKey]  = useState('')
  const [deptId,   setDeptId]   = useState('')
  const qc = useQueryClient()

  const { data: apps  = [] } = useQuery({ queryKey: ['apps'],  queryFn: () => api.get('/apps').then(r => r.data) })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then(r => r.data) })
  const { data: depts = [] } = useQuery({ queryKey: ['depts'], queryFn: () => api.get('/departments').then(r => r.data) })

  const grant = useMutation({
    mutationFn: () => api.post('/permissions', { user_id: user.id, app_id: +appId, role_key: roleKey, scope_dept_id: +deptId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userPerms', user.id] })
      setOpen(false)
      setAppId(''); setRoleKey(''); setDeptId('')
      onDone?.()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3 w-3" />เพิ่มสิทธิ์</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มสิทธิ์ให้ {user.email}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>แอปพลิเคชัน</Label>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger><SelectValue placeholder="เลือก App" /></SelectTrigger>
              <SelectContent>
                {apps.filter(a => a.is_active).map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.app_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={roleKey} onValueChange={setRoleKey}>
              <SelectTrigger><SelectValue placeholder="เลือก Role" /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.role_key} value={r.role_key}>{r.role_key} — {r.role_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>หน่วยงาน (Scope)</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger><SelectValue placeholder="เลือกหน่วยงาน" /></SelectTrigger>
              <SelectContent>
                {depts.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    [{d.dept_type}] {d.dept_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {grant.error && <p className="text-sm text-destructive">{grant.error.response?.data?.error || 'เกิดข้อผิดพลาด'}</p>}
          <Button className="w-full" onClick={() => grant.mutate()} disabled={!appId || !roleKey || !deptId || grant.isPending}>
            {grant.isPending ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── User Row ──────────────────────────────────────────────────
function UserRow({ user }) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const { data: perms = [], isLoading } = useQuery({
    queryKey: ['userPerms', user.id],
    queryFn: () => api.get(`/users/${user.id}/permissions`).then(r => r.data),
    enabled: expanded,
  })

  const revoke = useMutation({
    mutationFn: id => api.delete(`/permissions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userPerms', user.id] }),
  })

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-600 text-sm shrink-0">
            {user.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Badge variant={user.is_active ? 'success' : 'destructive'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <div className="text-center shrink-0">
            <p className="font-bold text-sm">{user.permission_count}</p>
            <p className="text-xs text-muted-foreground">apps</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">สิทธิ์ทั้งหมด</p>
              <GrantDialog user={user} />
            </div>
            {isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
              : perms.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีสิทธิ์ใดๆ</p>
              : (
                <div className="space-y-2">
                  {perms.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                      <code className="text-xs font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{p.app_name}</code>
                      <Badge variant="secondary">{p.role_key}</Badge>
                      <span className="text-xs text-muted-foreground flex-1">{p.dept_name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => revoke.mutate(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Users Page ────────────────────────────────────────────────
export default function Users() {
  const [search, setSearch] = useState('')
  const [query,  setQuery]  = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', query],
    queryFn: () => api.get('/users', { params: { search: query } }).then(r => r.data),
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ผู้ใช้งาน</h1>
        <p className="text-muted-foreground text-sm mt-1">จัดการสิทธิ์ผู้ใช้ทุกคนในระบบ NBU SSO</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="ค้นหา email หรือชื่อ..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setQuery(search)} />
        </div>
        <Button variant="outline" onClick={() => setQuery(search)}>ค้นหา</Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
        ) : (data?.users || []).map(user => (
          <UserRow key={user.id} user={user} />
        ))}
        {!isLoading && data && (
          <p className="text-xs text-muted-foreground text-right">
            แสดง {data.users.length} จาก {data.total} รายการ
          </p>
        )}
      </div>
    </div>
  )
}
