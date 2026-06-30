import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp, Plus, Trash2, UserX, AlertTriangle, X, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger, DialogClose,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchSelect } from '@/components/ui/search-select'
import api from '@/lib/api'

// ── Confirm Dialog ─────────────────────────────────────────────
function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'ยืนยัน', variant = 'destructive', onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={loading}>ยกเลิก</Button>
          </DialogClose>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add User Dialog ────────────────────────────────────────────
function AddUserDialog() {
  const [open,  setOpen]  = useState(false)
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const qc = useQueryClient()

  const add = useMutation({
    mutationFn: () => api.post('/users', { email: email.trim(), name: name.trim() }).then(r => r.data),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpen(false)
      setEmail('')
      setName('')
    },
  })

  function handleOpen(v) {
    if (v) { setEmail(''); setName(''); add.reset() }
    setOpen(v)
  }

  const emailValid = email.endsWith('@northbkk.ac.th')

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" />เพิ่มผู้ใช้ล่วงหน้า</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มบุคลากรล่วงหน้า</DialogTitle>
          <DialogDescription>
            เพิ่ม account บุคลากรใหม่ก่อนวันเริ่มงาน เพื่อกำหนดสิทธิ์แอปได้ทันที
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>อีเมล Google Workspace *</Label>
            <Input
              type="email"
              placeholder="firstname.l@northbkk.ac.th"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={email && !emailValid ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {email && !emailValid && (
              <p className="text-xs text-red-500">อีเมลต้องลงท้ายด้วย @northbkk.ac.th</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>ชื่อ-นามสกุล <span className="text-gray-400 font-normal">(ไม่บังคับ)</span></Label>
            <Input
              placeholder="จะ sync อัตโนมัติเมื่อ Login ครั้งแรก"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">ℹ️ หลังเพิ่มผู้ใช้แล้ว</p>
            <p>• ค้นหาชื่อในรายการ แล้วกด <span className="font-semibold">เพิ่มสิทธิ์</span> เพื่อกำหนดแอปที่เข้าถึงได้</p>
            <p>• ชื่อจะ update อัตโนมัติจาก Google เมื่อผู้ใช้ Login ครั้งแรก</p>
          </div>

          {add.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {add.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
            </p>
          )}

          <Button
            className="w-full"
            onClick={() => add.mutate()}
            disabled={!email || !emailValid || add.isPending}
          >
            {add.isPending ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Permission Dialog ─────────────────────────────────────
function EditPermDialog({ perm, userId }) {
  const [open,    setOpen]    = useState(false)
  const [roleKey, setRoleKey] = useState(perm.role_key)
  const [deptId,  setDeptId]  = useState(String(perm.scope_dept_id))
  const qc = useQueryClient()

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then(r => r.data) })
  const { data: depts = [] } = useQuery({ queryKey: ['depts'], queryFn: () => api.get('/departments').then(r => r.data) })

  const save = useMutation({
    mutationFn: () => api.patch(`/permissions/${perm.id}`, {
      role_key:      roleKey,
      scope_dept_id: +deptId,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userPerms', userId] })
      setOpen(false)
    },
  })

  function handleOpen(v) {
    if (v) { setRoleKey(perm.role_key); setDeptId(String(perm.scope_dept_id)); save.reset() }
    setOpen(v)
  }

  const changed = roleKey !== perm.role_key || deptId !== String(perm.scope_dept_id)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="แก้ไขสิทธิ์">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขสิทธิ์</DialogTitle>
          <DialogDescription>
            App: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">{perm.app_name}</code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <SearchSelect
              value={roleKey}
              onValueChange={setRoleKey}
              placeholder="เลือก Role"
              searchPlaceholder="ค้นหา Role..."
              options={roles.map(r => ({ value: r.role_key, label: `${r.role_key} — ${r.role_name}` }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>หน่วยงาน (Scope)</Label>
            <SearchSelect
              value={deptId}
              onValueChange={setDeptId}
              placeholder="เลือกหน่วยงาน"
              searchPlaceholder="ค้นหาหน่วยงาน..."
              options={depts.map(d => ({ value: String(d.id), label: `[${d.dept_type}] ${d.dept_name}` }))}
            />
          </div>

          {/* แสดงค่าเดิม */}
          <div className="rounded-lg bg-slate-50 border px-3 py-2 text-xs text-gray-500 space-y-0.5">
            <p className="font-medium text-gray-600">ค่าเดิม</p>
            <p>Role: <span className="font-mono">{perm.role_key}</span> → Scope: {perm.dept_name}</p>
          </div>

          {save.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {save.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={!changed || save.isPending}
          >
            {save.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Grant Permission Dialog ────────────────────────────────────
function GrantDialog({ user }) {
  const [open, setOpen] = useState(false)
  const [appId,   setAppId]   = useState('')
  const [roleKey, setRoleKey] = useState('')
  const [deptId,  setDeptId]  = useState('')
  const qc = useQueryClient()

  const { data: apps  = [] } = useQuery({ queryKey: ['apps'],  queryFn: () => api.get('/apps').then(r => r.data) })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then(r => r.data) })
  const { data: depts = [] } = useQuery({ queryKey: ['depts'], queryFn: () => api.get('/departments').then(r => r.data) })

  const grant = useMutation({
    mutationFn: () => api.post('/permissions', {
      user_id: user.id, app_id: +appId, role_key: roleKey, scope_dept_id: +deptId,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userPerms', user.id] })
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpen(false)
      setAppId(''); setRoleKey(''); setDeptId('')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <Plus className="h-3.5 w-3.5" />เพิ่มสิทธิ์
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มสิทธิ์</DialogTitle>
          <DialogDescription>กำหนดสิทธิ์การเข้าถึงให้ {user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>แอปพลิเคชัน</Label>
            <SearchSelect
              value={appId}
              onValueChange={setAppId}
              placeholder="เลือก App"
              searchPlaceholder="ค้นหา App..."
              options={apps.filter(a => a.is_active).map(a => ({ value: String(a.id), label: a.app_name }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <SearchSelect
              value={roleKey}
              onValueChange={setRoleKey}
              placeholder="เลือก Role"
              searchPlaceholder="ค้นหา Role..."
              options={roles.map(r => ({ value: r.role_key, label: `${r.role_key} — ${r.role_name}` }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>หน่วยงาน (Scope)</Label>
            <SearchSelect
              value={deptId}
              onValueChange={setDeptId}
              placeholder="เลือกหน่วยงาน"
              searchPlaceholder="ค้นหาหน่วยงาน..."
              options={depts.map(d => ({ value: String(d.id), label: `[${d.dept_type}] ${d.dept_name}` }))}
            />
          </div>
          {grant.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {grant.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => grant.mutate()}
            disabled={!appId || !roleKey || !deptId || grant.isPending}
          >
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
  const [confirmRevoke, setConfirmRevoke] = useState(null)  // perm object
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()

  const { data: perms = [], isLoading } = useQuery({
    queryKey: ['userPerms', user.id],
    queryFn:  () => api.get(`/users/${user.id}/permissions`).then(r => r.data),
    enabled:  expanded,
  })

  const revoke = useMutation({
    mutationFn: id => api.delete(`/permissions/${id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['userPerms', user.id] })
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmRevoke(null)
    },
  })

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/users/${user.id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmDelete(false)
    },
  })

  return (
    <>
      <Card>
        <CardContent className="py-4">
          {/* User header row */}
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-600 text-sm shrink-0">
              {user.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <Badge variant={user.is_active ? 'success' : 'destructive'}>
              {user.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <div className="text-center shrink-0 w-14">
              <p className="font-bold text-sm">{user.permission_count}</p>
              <p className="text-xs text-gray-400">apps</p>
            </div>
            {/* Delete user button */}
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
              onClick={() => setConfirmDelete(true)}
              title="ลบผู้ใช้"
            >
              <UserX className="h-4 w-4" />
            </Button>
            {/* Expand button */}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setExpanded(v => !v)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Permissions section */}
          {expanded && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">สิทธิ์การเข้าถึง</p>
                <GrantDialog user={user} />
              </div>

              {isLoading ? (
                <p className="text-sm text-gray-400 py-2">กำลังโหลด...</p>
              ) : perms.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">ยังไม่มีสิทธิ์ใดๆ</p>
              ) : (
                /* ตาราง permission */
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="text-left px-4 py-2 font-semibold">App</th>
                        <th className="text-left px-4 py-2 font-semibold">Role</th>
                        <th className="text-left px-4 py-2 font-semibold">Scope (หน่วยงาน)</th>
                        <th className="px-4 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {perms.map((p, i) => (
                        <tr key={p.id} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                          <td className="px-4 py-2.5">
                            <code className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-mono">
                              {p.app_name}
                            </code>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {p.role_key}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">
                            <span className="font-medium">[{p.scope_level}]</span> {p.dept_name}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <EditPermDialog perm={p} userId={user.id} />
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setConfirmRevoke(p)}
                                title="ลบสิทธิ์นี้"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm: ลบสิทธิ์ */}
      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={v => !v && setConfirmRevoke(null)}
        title="ยืนยันการลบสิทธิ์"
        description={confirmRevoke
          ? `ลบสิทธิ์ "${confirmRevoke.role_key}" ของ ${user.email} ใน ${confirmRevoke.app_name} ใช่ไหม? ผู้ใช้จะไม่สามารถเข้าแอปนี้ได้ทันที`
          : ''}
        confirmLabel="ลบสิทธิ์"
        onConfirm={() => revoke.mutate(confirmRevoke?.id)}
        loading={revoke.isPending}
      />

      {/* Confirm: ลบ user */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="ยืนยันการลบผู้ใช้"
        description={`ลบ "${user.name}" (${user.email}) ออกจากระบบใช่ไหม? สิทธิ์ทั้งหมดของผู้ใช้นี้จะถูกลบด้วย และไม่สามารถกู้คืนได้`}
        confirmLabel="ลบผู้ใช้"
        onConfirm={() => deleteUser.mutate()}
        loading={deleteUser.isPending}
      />
    </>
  )
}

// ── Users Page ────────────────────────────────────────────────
export default function Users() {
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  () => api.get('/users', { params: { limit: 500 } }).then(r => r.data),
  })

  // Master data สำหรับ dropdown
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then(r => r.data) })
  const { data: depts = [] } = useQuery({ queryKey: ['depts'], queryFn: () => api.get('/departments').then(r => r.data) })

  const allUsers = data?.users || []

  // Filter รวม: search + role + scope
  const filtered = allUsers.filter(u => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())

    const matchRole = !roleFilter ||
      (u.roles || []).includes(roleFilter)

    const matchDept = !deptFilter ||
      (u.dept_ids || []).map(String).includes(deptFilter)

    return matchSearch && matchRole && matchDept
  })

  const hasFilter = search || roleFilter || deptFilter

  function clearAll() {
    setSearch('')
    setRoleFilter('')
    setDeptFilter('')
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ผู้ใช้งาน</h1>
        <p className="text-sm text-gray-500 mt-1">จัดการสิทธิ์ผู้ใช้ทุกคนในระบบ NBU SSO</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 pr-8 h-9"
            placeholder="ค้นหา email / ชื่อ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Role dropdown */}
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="ทุก Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุก Role</SelectItem>
            {roles.map(r => (
              <SelectItem key={r.role_key} value={r.role_key}>
                {r.role_key} — {r.role_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Scope dropdown */}
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue placeholder="ทุกหน่วยงาน" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุกหน่วยงาน</SelectItem>
            {depts.map(d => (
              <SelectItem key={d.id} value={String(d.id)}>
                [{d.dept_type}] {d.dept_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ล้าง filter */}
        {hasFilter && (
          <button onClick={clearAll} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-3.5 w-3.5" />ล้างทั้งหมด
          </button>
        )}

        {/* นับผลลัพธ์ */}
        <span className="text-sm text-gray-400 ml-1">
          {filtered.length} / {allUsers.length} คน
        </span>

        <div className="ml-auto">
          <AddUserDialog />
        </div>
      </div>

      {/* Active filter badges */}
      {hasFilter && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-medium">
              ค้นหา: "{search}"
              <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {roleFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-medium">
              Role: {roleFilter}
              <button onClick={() => setRoleFilter('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {deptFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-medium">
              Scope: {depts.find(d => String(d.id) === deptFilter)?.dept_name || deptFilter}
              <button onClick={() => setDeptFilter('')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}

      {/* User list */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</p>
        ) : filtered.map(user => (
          <UserRow key={user.id} user={user} />
        ))}
      </div>
    </div>
  )
}
