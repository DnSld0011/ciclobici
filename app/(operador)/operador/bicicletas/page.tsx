'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bicicleta, BicicletaEstado, Estacion } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Search, QrCode, Download, Bike } from 'lucide-react'
import { generarCodigoBicicleta } from '@/lib/utils/codigos'

type FormBici = { tipo: string; marca: string; modelo: string; estacion_id: string; estado: BicicletaEstado }
const formVacio: FormBici = { tipo: '', marca: '', modelo: '', estacion_id: '', estado: 'disponible' }

export default function BicicletasPage() {
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [dialogQr, setDialogQr] = useState<Bicicleta | null>(null)
  const [form, setForm] = useState<FormBici>(formVacio)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const supabase = createClient()

  async function cargar() {
    const [{ data: bicis }, { data: ests }] = await Promise.all([
      supabase.from('bicicletas').select('*, estacion:estaciones(nombre)').order('created_at', { ascending: false }),
      supabase.from('estaciones').select('*').eq('estado', 'activa').order('nombre'),
    ])
    if (bicis) setBicicletas(bicis)
    if (ests) setEstaciones(ests)
  }

  useEffect(() => { cargar() }, [])

  async function generarQR(codigo: string): Promise<string> {
    const QRCode = (await import('qrcode')).default
    return QRCode.toDataURL(codigo, { width: 256, margin: 2 })
  }

  async function abrirQr(bici: Bicicleta) {
    setDialogQr(bici)
    if (bici.qr_url) {
      setQrDataUrl(bici.qr_url)
    } else {
      const url = await generarQR(bici.codigo)
      setQrDataUrl(url)
    }
  }

  function descargarQr() {
    if (!dialogQr || !qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${dialogQr.codigo}.png`
    a.click()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.tipo.trim()) { setError('El tipo es requerido'); return }
    setLoading(true)
    try {
      // Get next sequential number
      const { count } = await supabase.from('bicicletas').select('*', { count: 'exact', head: true })
      const codigo = generarCodigoBicicleta((count ?? 0) + 1)
      const qrUrl = await generarQR(codigo)

      const payload = {
        codigo, tipo: form.tipo.trim(), marca: form.marca || null,
        modelo: form.modelo || null, qr_url: qrUrl,
        estado: form.estado, estacion_id: form.estacion_id || null,
      }
      const { error: err } = await supabase.from('bicicletas').insert(payload)
      if (err) throw err
      setDialogAbierto(false)
      setForm(formVacio)
      await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(id: string, estado: BicicletaEstado) {
    await supabase.from('bicicletas').update({ estado }).eq('id', id)
    await cargar()
  }

  const filtradas = bicicletas.filter(b => {
    const matchCodigo = b.codigo.toLowerCase().includes(filtro.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || b.estado === filtroEstado
    return matchCodigo && matchEstado
  })

  const badgeVariant = (estado: BicicletaEstado) => ({
    disponible: 'success', en_viaje: 'default', mantenimiento: 'warning', baja: 'destructive',
  }[estado] as 'success' | 'default' | 'warning' | 'destructive')

  const estadoLabel: Record<BicicletaEstado, string> = {
    disponible: 'Disponible', en_viaje: 'En Viaje', mantenimiento: 'Mantenimiento', baja: 'Baja',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bicicletas</h1>
          <p className="text-gray-500 text-sm">Gestión de bicicletas con código y QR automático</p>
        </div>
        <Button onClick={() => { setForm(formVacio); setError(''); setDialogAbierto(true) }}>
          <Plus size={16} /> Nueva Bicicleta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
          <Card key={e}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{bicicletas.filter(b => b.estado === e).length}</div>
              <div className="text-xs text-gray-500">{estadoLabel[e]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <Input placeholder="Buscar por código..." className="pl-9"
                value={filtro} onChange={e => setFiltro(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="en_viaje">En Viaje</SelectItem>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo / Marca</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Sin bicicletas</TableCell></TableRow>
              )}
              {filtradas.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-medium text-blue-700">{b.codigo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Bike size={14} className="text-gray-400" />
                      <span>{b.tipo}{b.marca ? ` — ${b.marca}` : ''}{b.modelo ? ` ${b.modelo}` : ''}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={b.estado} onValueChange={(v) => cambiarEstado(b.id, v as BicicletaEstado)}>
                      <SelectTrigger className="w-36 h-7">
                        <Badge variant={badgeVariant(b.estado)} className="cursor-pointer">{estadoLabel[b.estado]}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {(['disponible', 'en_viaje', 'mantenimiento', 'baja'] as BicicletaEstado[]).map(e => (
                          <SelectItem key={e} value={e}>{estadoLabel[e]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {(b.estacion as unknown as { nombre?: string })?.nombre ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => abrirQr(b)}>
                      <QrCode size={14} /> QR
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Nueva Bicicleta */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Bicicleta</DialogTitle></DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Input placeholder="Urbana, MTB, Eléctrica..." value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input placeholder="Trek, Giant..." value={form.marca}
                  onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input placeholder="FX3, 2024..." value={form.modelo}
                  onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estación Inicial</Label>
              <Select value={form.estacion_id} onValueChange={v => setForm(p => ({ ...p, estacion_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin asignar</SelectItem>
                  {estaciones.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Alert variant="info">
              <AlertDescription className="text-xs">
                El código (formato BC-YYYYMMDD-XXXX) y el QR se generarán automáticamente.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Bicicleta'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog QR */}
      <Dialog open={!!dialogQr} onOpenChange={() => setDialogQr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Código QR</DialogTitle></DialogHeader>
          {dialogQr && (
            <div className="text-center space-y-4">
              <p className="font-mono font-bold text-blue-700 text-lg">{dialogQr.codigo}</p>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR" className="mx-auto rounded-lg border" width={220} height={220} />
              )}
              <Button onClick={descargarQr} className="w-full">
                <Download size={16} /> Descargar QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
