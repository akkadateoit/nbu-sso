import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import api from '@/lib/api'

function CreateAppDialog({ onCreated }) {
  const [open, setOpen]         = useState(false)
  const [appName, setAppName]   = useState('')
  const [desc, setDesc]         = useState('')
  const [newSecret, setNewSecret] = useState(null)
  const [copied, setCopied]     = useState(false)
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: () => api.post('/apps', { app_name: appName, description: desc }).then(r => r.data),
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
    setNewSecret(null)
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
              <p className="text-xs text-muted-foreground">ใช้ตัวพิมพ์เล็ก ตัวเลข และ - เท่านั้น</p>
            </div>
            <div className="space-y-2">
              <Label>คำอธิบาย</Label>
              <Input placeholder="ชื่อระบบหรือรายละเอียดแอป" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            {create.error && (
              <p className="text-sm text-destructive">{create.error.response?.data?.error || 'เกิดข้อผิดพลาด'}</p>
            )}
            <Button className="w-full" onClick={() => create.mutate()} disabled={!appName || create.isPending}>
              {create.isPending ? 'กำลังสร้าง...' : 'ลงทะเบียนแอป'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Apps() {
  const qc = useQueryClient()
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['apps'],
    queryFn: () => api.get('/apps').then(r => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/apps/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">แอปพลิเคชัน</h1>
          <p className="text-muted-foreground text-sm mt-1">แอปทั้งหมดที่ลงทะเบียนใช้งาน NBU SSO</p>
        </div>
        <CreateAppDialog />
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
        ) : apps.map(app => (
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
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{app.description || '—'}</p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-2xl font-bold text-slate-700">{app.permission_count}</p>
                <p className="text-xs text-muted-foreground">users</p>
              </div>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
