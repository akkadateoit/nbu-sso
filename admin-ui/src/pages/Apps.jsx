import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Copy, Check, ToggleLeft, ToggleRight, Search, X, Pencil, Link2, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import api from '@/lib/api'

function CreateAppDialog({ onCreated }) {
  const [open, setOpen]         = useState(false)
  const [appName, setAppName]   = useState('')
  const [desc, setDesc]         = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [newSecret, setNewSecret] = useState(null)
  const [copied, setCopied]     = useState(false)
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: () => api.post('/apps', {
      app_name: appName,
      description: desc,
      callback_urls: urlsText.split('\n').map(s => s.trim()).filter(Boolean),
    }).then(r => r.data),
    onSuccess: data => {
      setNewSecret(data.app_secret)
      qc.invalidateQueries({ queryKey: ['apps'] })
      onCreated?.()
    },
  })

  function handleCopy() {
    navigator.clipboard.writeText(newSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setOpen(false)
    setAppName('')
    setDesc('')
    setUrlsText('')
    setNewSecret(null)
    create.reset()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />ลงทะเบียนแอปใหม่</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ลงทะเบียนแอปพลิเคชันใหม่</DialogTitle>
        </DialogHeader>

        {newSecret ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-medium text-green-800 mb-2">✅ สร้างแอปสำเร็จ! บันทึก App Secret นี้ไว้</p>
              <p className="text-xs text-green-700 mb-3">App Secret จะไม่แสดงอีกหลังจากปิดหน้าต่างนี้</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1.5 font-mono break-all">{newSecret}</code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>เสร็จสิ้น</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>App ID (app_name) *</Label>
              <Input placeholder="เช่น hr-system, e-learning" value={appName} onChange={e => setAppName(e.target.value)} />
              <p className="text-xs text-gray-500">ใช้ตัวพิมพ์เล็ก ตัวเลข และ - เท่านั้น</p>
            </div>
            <div className="space-y-2">
              <Label>คำอธิบาย</Label>
              <Input placeholder="ชื่อระบบหรือรายละเอียดแอป" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Callback URLs ที่อนุญาต * <span className="text-gray-400 font-normal">(1 บรรทัดต่อ 1 URL)</span></Label>
              <textarea
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] font-mono"
                placeholder={"https://myapp.northbkk.ac.th\nhttps://myapp.northbkk.ac.th/auth/callback"}
                value={urlsText}
                onChange={e => setUrlsText(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                ระบบจะอนุญาตให้ redirect กลับเฉพาะ origin (โดเมน) เหล่านี้เท่านั้น ป้องกัน Open Redirect
              </p>
            </div>
            {create.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {create.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => create.mutate()}
              disabled={!appName || !urlsText.trim() || create.isPending}
            >
              {create.isPending ? 'กำลังสร้าง...' : 'ลงทะเบียนแอป'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditCallbackUrlsDialog({ app }) {
  const [open, setOpen]         = useState(false)
  const [urlsText, setUrlsText] = useState((app.callback_urls || []).join('\n'))
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => api.patch(`/apps/${app.id}`, {
      callback_urls: urlsText.split('\n').map(s => s.trim()).filter(Boolean),
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] })
      setOpen(false)
    },
  })

  function handleOpen(v) {
    if (v) { setUrlsText((app.callback_urls || []).join('\n')); save.reset() }
    setOpen(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="แก้ไข Callback URLs">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Callback URLs — {app.app_name}</DialogTitle>
          <DialogDescription>URL ที่อนุญาตให้ SSO redirect กลับหลัง Login สำเร็จ (1 บรรทัดต่อ 1 URL)</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <textarea
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono"
            value={urlsText}
            onChange={e => setUrlsText(e.target.value)}
          />
          {save.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {save.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
            </p>
          )}
          <Button className="w-full" onClick={() => save.mutate()} disabled={!urlsText.trim() || save.isPending}>
            {save.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Apps() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['apps'],
    queryFn: () => api.get('/apps').then(r => r.data),
  })

  const [confirmDelete, setConfirmDelete] = useState(null) // app object

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/apps/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  })

  const deleteApp = useMutation({
    mutationFn: (id) => api.delete(`/apps/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] })
      setConfirmDelete(null)
    },
  })

  const filtered = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">แอปพลิเคชัน</h1>
          <p className="text-sm text-gray-500 mt-1">แอปทั้งหมดที่ลงทะเบียนใช้งาน NBU SSO</p>
        </div>
        <CreateAppDialog />
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 pr-8"
            placeholder="ค้นหา App ID หรือชื่อระบบ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-sm text-gray-400 shrink-0">
          {filtered.length} / {apps.length} apps
        </span>
      </div>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base">ยืนยันการลบ App</DialogTitle>
            </div>
            <DialogDescription>
              {confirmDelete?.permission_count > 0
                ? `ไม่สามารถลบได้ — "${confirmDelete?.app_name}" ยังมีผู้ใช้ ${confirmDelete?.permission_count} คนที่มีสิทธิ์อยู่ กรุณาถอนสิทธิ์ทั้งหมดก่อน`
                : `ลบ "${confirmDelete?.app_name}" ออกจากระบบถาวรใช่ไหม? ไม่สามารถกู้คืนได้`}
            </DialogDescription>
          </DialogHeader>
          {deleteApp.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {deleteApp.error.response?.data?.error || 'เกิดข้อผิดพลาด'}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" onClick={() => deleteApp.reset()}>ยกเลิก</Button>
            </DialogClose>
            {confirmDelete?.permission_count === 0 && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteApp.mutate(confirmDelete.id)}
                disabled={deleteApp.isPending}
              >
                {deleteApp.isPending ? 'กำลังลบ...' : 'ลบ App'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">ไม่พบแอปที่ค้นหา</p>
        ) : filtered.map(app => (
          <Card key={app.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm uppercase shrink-0">
                {app.app_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{app.app_name}</p>
                  <Badge variant={app.is_active ? 'success' : 'destructive'}>
                    {app.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {(!app.callback_urls || app.callback_urls.length === 0) && (
                    <Badge variant="warning" title="แอปนี้ยังไม่มี Callback URL — Login จะถูกปฏิเสธ">
                      ⚠ ไม่มี Callback URL
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{app.description || '—'}</p>
                {app.callback_urls?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                    {app.callback_urls.join(', ')}
                  </p>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-2xl font-bold text-slate-700">{app.permission_count}</p>
                <p className="text-xs text-gray-500">users</p>
              </div>
              <EditCallbackUrlsDialog app={app} />
              <Button
                variant="ghost" size="sm"
                className={app.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}
                onClick={() => toggleActive.mutate({ id: app.id, is_active: !app.is_active })}
                disabled={app.app_name === 'sso-admin'}
              >
                {app.is_active
                  ? <><ToggleRight className="h-4 w-4" />ปิดใช้งาน</>
                  : <><ToggleLeft  className="h-4 w-4" />เปิดใช้งาน</>}
              </Button>
              {/* ลบ App — แสดงเมื่อปิดแล้วเท่านั้น, สีเทาถ้ายังมี user */}
              {!app.is_active && app.app_name !== 'sso-admin' && (
                <Button
                  variant="ghost" size="sm"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 px-2"
                  onClick={() => setConfirmDelete(app)}
                  title={app.permission_count > 0
                    ? `ถอนสิทธิ์ผู้ใช้ ${app.permission_count} คนก่อนลบ`
                    : 'ลบ App นี้ออกจากระบบ'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
