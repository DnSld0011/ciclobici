'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mantenimiento, Bicicleta } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Wrench, Filter } from 'lucide-react'

const TIPOS_INTERVENCION = [
  'Mantenimiento Preventivo', 'Reparación de Frenos', 'Cambio de Neumático',
  'Lubricación de Cadena', 'Ajuste de Marcha', 'Revisión Eléctrica',
  'Reemplazo de Sillín', 'Reparación de Manubrio', 'Revisión General',
]

export default function MantenimientoPage() {
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([])
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [form, setForm] = useState({
    bicicleta_id: '', tipo_intervencion: '', descripcion: '',
    responsable: '', fecha: new Date().toISOString().slice(0, 16),
    dejar_disponible: true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busquedaBici, setBusquedaBici] = useState('')
  const supabase = createClient()

  async function cargar() {
    const { data } = await supabase
      .from('mantenimientos')
      .select('*, bicicleta:bicicletas(codigo, tipo, marca)')
      .order('fecha', { ascending: false })
    if (data) setMantenimientos(data)
  }

  async function cargarBicis(busqueda: string) {
    const { data } = await supabase
      .from('bicicletas')
      .select('*')
      .ilike('codigo', `%${busqueda}%`)
      .limit(10)
    if (data) setBicicletas(data)
  }

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (busquedaBici.length >= 2) cargarBicis(busquedaBici) }, [busquedaBici])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.bicicleta_id) { setError('Selecciona una bicicleta'); return }
    if (!form.tipo_intervencion) { setError('Selecciona el tipo de intervención'); return }
    if (!form.responsable.trim()) { setError('El responsable es requerido'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.from('mantenimientos').insert({
        bicicleta_id: form.bicicleta_id,
        tipo_intervencion: form.tipo_intervencion,
        descripcion: form.descripcion || null,
        responsable: form.responsable.trim(),
        fecha: new Date(form.fecha).toISOString(),
      })
      if (err) throw err

      // Update bike status
      const nuevoEstado = form.dejar_disponible ? 'disponible' : 'mantenimiento'
      await supabase.from('bicicletas').update({ estado: nuevoEstado }).eq('id', form.bicicleta_id)

      setDialogAbierto(false)
      setForm({ bicicleta_id: '', tipo_intervencion: '', descripcion: '', responsable: '',
        fecha: new Date().toISOString().slice(0, 16), dejar_disponible: true })
      setBusquedaBici('')
      await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const filtrados = mantenimientos.filter(m => {
    const bici = m.bicicleta as unknown as { codigo: string } | null
    const matchCodigo = !filtroCodigo || (bici?.codigo ?? '').toLowerCase().includes(filtroCodigo.toLowerCase())
    const fecha = new Date(m.fecha)
    const matchDesde = !filtroFechaDesde || fecha >= new Date(filtroFechaDesde)
    const matchHasta = !filtroFechaHasta || fecha <= new Date(filtroFechaHasta + 'T23:59:59')
    return matchCodigo && matchDesde && matchHasta
  })

  const bicicletaSeleccionada = bicicletas.find(b => b.id === form.bicicleta_id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimiento</h1>
          <p className="text-gray-500 text-sm">Registro de intervenciones y mantenimientos</p>
        </div>
        <Button onClick={() => { setError(''); setDialogAbierto(true) }}>
          <Plus size={16} /> Registrar Mantenimiento
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <Input placeholder="Código bicicleta..." className="pl-9"
                value={filtroCodigo} onChange={e => setFiltroCodigo(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <Input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} className="w-36" />
              <span className="text-gray-400 text-sm">—</span>
              <Input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} className="w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bicicleta</TableHead>
                <TableHead>Tipo Intervención</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Sin registros</TableCell></TableRow>
              )}
              {filtrados.map(m => {
                const bici = m.bicicleta as unknown as { codigo: string; tipo: string } | null
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Wrench size={14} className="text-gray-400" />
                        <span className="font-mono text-sm font-medium text-blue-700">{bici?.codigo}</span>
                        <span className="text-xs text-gray-500">{bici?.tipo}</span>
                      </div>
                    </TableCell>
                    <TableCell>{m.tipo_intervencion}</TableCell>
                    <TableCell className="text-gray-600 text-sm max-w-48 truncate">{m.descripcion ?? '—'}</TableCell>
                    <TableCell>{m.responsable}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Mantenimiento</DialogTitle></DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label>Bicicleta (buscar por código)</Label>
              <Input placeholder="BC-..." value={busquedaBici}
                onChange={e => { setBusquedaBici(e.target.value); setForm(p => ({ ...p, bicicleta_id: '' })) }} />
              {bicicletas.length > 0 && !bicicletaSeleccionada && (
                <div className="border rounded-md divide-y max-h-40 overflow-auto">
                  {bicicletas.map(b => (
                    <button key={b.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between"
                      onClick={() => { setForm(p => ({ ...p, bicicleta_id: b.id })); setBusquedaBici(b.codigo) }}>
                      <span className="font-mono font-medium text-blue-700">{b.codigo}</span>
                      <span className="text-gray-500">{b.tipo} {b.marca}</span>
                    </button>
                  ))}
                </div>
              )}
              {bicicletaSeleccionada && (
                <p className="text-xs text-green-600">✓ Seleccionada: {bicicletaSeleccionada.codigo} — {bicicletaSeleccionada.tipo}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Intervención</Label>
              <Select value={form.tipo_intervencion} onValueChange={v => setForm(p => ({ ...p, tipo_intervencion: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_INTERVENCION.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea placeholder="Detalles de la intervención..." value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Input placeholder="Nombre del técnico" value={form.responsable}
                  onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Fecha y Hora</Label>
                <Input type="datetime-local" value={form.fecha}
                  onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} required />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="disponible" checked={form.dejar_disponible}
                onChange={e => setForm(p => ({ ...p, dejar_disponible: e.target.checked }))} />
              <Label htmlFor="disponible" className="cursor-pointer">Marcar bicicleta como disponible al terminar</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Registrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
