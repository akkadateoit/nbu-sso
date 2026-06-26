import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ShieldCheck, Building2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'

// ── Shared ────────────────────────────────────────────────────
const DEPT_TYPES = ['UNIVERSITY', 'FACULTY', 'BRANCH', 'OFFICE']
const DEPT_TYPE_COLORS = {
  UNIVERSITY: 'bg-purple-100 text-purple-800',
  FACULTY:    'bg-blue-100 text-blue-800',
  BRANCH:     'bg-green-100 text-green-800',
  OFFICE:     'bg-orange-100 text-orange-800',
}

function ErrorMsg({ error }) {
  if (!error) return null
  const msg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด'
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  )
}

// ── ROLES SECTION ─────────────────────────────────────────────
function RoleFormDialog({ role, onDone }) {
  const isEdit = !!role
  const [open, setOpen]     = useState(false)
  const [key,  setKey]      = useState(role?.role_key  || '')
  const [name, setName]     = useState(role?.role_name || '')
  const [desc, setDesc]     = useState(role?.description || '')
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/roles/${role.role_key}`, { role_name: name, description: desc }).then(r => r.data)
      : api.post('/roles', { role_key: key, role_name: name, description: desc }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setOpen(false)
      onDone?.()
    },
  })

  function handleOpen(v) {
    if (v) {
      setKey(role?.role_key || '')
      setName(role?.role_name || '')
      setDesc(role?.description || '')
      save.reset()
    }
    setOpen(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isEdit
          ? <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
          : <Button size="sm"><Plus className="h-4 w-4" />เพิ่ม Role</Button>
        }
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `แก้ไข Role: ${role.role_key}` : 'เพิ่ม Role ใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Role Key *</Label>
              <Input
                placeholder="เช่น DEAN, HEAD_OF_DEPT"
                value={key}
                onChange={e => setKey(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-gray-500">ใช้ตัวพิมพ์ใหญ่ ตัวเลข และ _ เท่านั้น เช่น ADMIN, DEAN</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>ชื่อตำแหน่ง *</Label>
            <Input placeholder="เช่น คณบดี, หัวหน้าสาขา" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย</Label>
            <Input placeholder="อธิบายสิทธิ์ของ Role นี้" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <ErrorMsg error={save.error} />
          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={(!isEdit && !key) || !name || save.isPending}
          >
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่ม Role'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RolesSection() {
  const qc = useQueryClient()
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const remove = useMutation({
    mutationFn: key => api.delete(`/roles/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
    onError: e => alert(e.response?.data?.error || 'ลบไม่สำเร็จ'),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Roles (ตำแหน่ง/สิทธิ์)
        </CardTitle>
        <RoleFormDialog />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 pb-4 text-sm text-gray-500">กำลังโหลด...</p>
        ) : (
          <div className="divide-y">
            {roles.map((role, i) => (
              <div key={role.role_key} className={`flex items-start gap-3 px-6 py-3 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                <code className="mt-0.5 shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-white">
                  {role.role_key}
                </code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{role.role_name}</p>
                  {role.description && <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {role.usage_count > 0 && (
                    <span className="text-xs text-gray-400">{role.usage_count} users</span>
                  )}
                  <RoleFormDialog role={role} />
                  <Button
                    size="sm" variant="ghost"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (role.usage_count > 0) { alert(`ไม่สามารถลบได้ เพราะมี ${role.usage_count} user ใช้ Role นี้อยู่`); return }
                      if (confirm(`ลบ Role "${role.role_key}" ใช่ไหม?`)) remove.mutate(role.role_key)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {!roles.length && <p className="px-6 pb-4 text-sm text-gray-400">ยังไม่มี Role</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── DEPARTMENTS SECTION ───────────────────────────────────────
function DeptFormDialog({ dept, parents, onDone }) {
  const isEdit = !!dept
  const [open,     setOpen]     = useState(false)
  const [name,     setName]     = useState(dept?.dept_name || '')
  const [type,     setType]     = useState(dept?.dept_type || '')
  const [parentId, setParentId] = useState(dept?.parent_id ? String(dept.parent_id) : '')
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/departments/${dept.id}`, { dept_name: name, dept_type: type, parent_id: parentId ? +parentId : null }).then(r => r.data)
      : api.post('/departments',             { dept_name: name, dept_type: type, parent_id: parentId ? +parentId : null }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depts'] })
      setOpen(false)
      onDone?.()
    },
  })

  function handleOpen(v) {
    if (v) {
      setName(dept?.dept_name || '')
      setType(dept?.dept_type || '')
      setParentId(dept?.parent_id ? String(dept.parent_id) : '')
      save.reset()
    }
    setOpen(v)
  }

  const validParents = (parents || []).filter(p => !isEdit || p.id !== dept?.id)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isEdit
          ? <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
          : <Button size="sm"><Plus className="h-4 w-4" />เพิ่มหน่วยงาน</Button>
        }
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `แก้ไข: ${dept.dept_name}` : 'เพิ่มหน่วยงานใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อหน่วยงาน *</Label>
            <Input placeholder="เช่น คณะวิศวกรรมศาสตร์" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ระดับ (dept_type) *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="เลือกระดับ" /></SelectTrigger>
              <SelectContent>
                {DEPT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>สังกัด (parent)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder="ไม่มีสังกัด (ระดับสูงสุด)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— ไม่มีสังกัด —</SelectItem>
                {validParents.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    [{p.dept_type}] {p.dept_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ErrorMsg error={save.error} />
          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={!name || !type || save.isPending}
          >
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มหน่วยงาน'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DepartmentsSection() {
  const qc = useQueryClient()
  const { data: depts = [], isLoading } = useQuery({
    queryKey: ['depts'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const remove = useMutation({
    mutationFn: id => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depts'] }),
    onError: e => alert(e.response?.data?.error || 'ลบไม่สำเร็จ'),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-green-600" />
          หน่วยงาน / Scope
        </CardTitle>
        <DeptFormDialog parents={depts} />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 pb-4 text-sm text-gray-500">กำลังโหลด...</p>
        ) : (
          <div className="divide-y">
            {depts.map((d, i) => (
              <div key={d.id} className={`flex items-center gap-3 px-6 py-3 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${DEPT_TYPE_COLORS[d.dept_type] || 'bg-gray-100 text-gray-700'}`}>
                  {d.dept_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.dept_name}</p>
                  {d.parent_name && (
                    <p className="text-xs text-gray-400">สังกัด: {d.parent_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.usage_count > 0 && (
                    <span className="text-xs text-gray-400">{d.usage_count} users</span>
                  )}
                  <DeptFormDialog dept={d} parents={depts} />
                  <Button
                    size="sm" variant="ghost"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (d.usage_count > 0) { alert(`ไม่สามารถลบได้ เพราะมี ${d.usage_count} user ใช้ Scope นี้อยู่`); return }
                      if (confirm(`ลบหน่วยงาน "${d.dept_name}" ใช่ไหม?`)) remove.mutate(d.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {!depts.length && <p className="px-6 pb-4 text-sm text-gray-400">ยังไม่มีหน่วยงาน</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function MasterData() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
        <p className="text-muted-foreground text-sm mt-1">จัดการ Role และหน่วยงาน (Scope) ของระบบ SSO</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RolesSection />
        <DepartmentsSection />
      </div>
    </div>
  )
}
