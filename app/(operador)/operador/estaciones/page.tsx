'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Estacion, EstacionEstado } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil, Trash2, Search, Building2, MapPin } from 'lucide-react'
import { validarCoordenadas } from '@/lib/utils/codigos'

type FormEstacion = {
  nombre: string; direccion: string; latitud: string
  longitud: string; capacidad: string; estado: EstacionEstado
}

const formVacio: FormEstacion = {
  nombre: '', direccion: '', latitud: '', longitud: '', capacidad: '', estado: 'activa',
}

export default function EstacionesPage() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [editando, setEditando] = useState<Estacion | null>(null)
  const [form, setForm] = useState<FormEstacion>(formVacio)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function cargar() {
    const { data } = await supabase.from('estaciones').select('*').order('nombre')
    if (data) setEstaciones(data)
  }

  useEffect(() => { cargar() }, [])

  function abrirCrear() {
    setEditando(null)
    setForm(formVacio)
    setError('')
    setDialogAbierto(true)
  }

  function abrirEditar(est: Estacion) {
    setEditando(est)
    setForm({
      nombre: est.nombre, direccion: est.direccion,
      latitud: String(est.latitud), longitud: String(est.longitud),
      capacidad: String(est.capacidad), estado: est.estado,
    })
    setError('')
    setDialogAbierto(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const lat = parseFloat(form.latitud)
    const lng = parseFloat(form.longitud)
    const cap = parseInt(form.capacidad)

    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!validarCoordenadas(lat, lng)) { setError('Coordenadas inválidas'); return }
    if (!cap || cap <= 0) { setError('La capacidad debe ser mayor a 0'); return }

    setLoading(true)
    const payload = {
      nombre: form.nombre.trim(), direccion: form.direccion.trim(),
      latitud: lat, longitud: lng, capacidad: cap, estado: form.estado,
    }

    try {
      if (editando) {
        const { error: err } = await supabase.from('estaciones').update(payload).eq('id', editando.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('estaciones').insert(payload)
        if (err) throw err
      }
      setDialogAbierto(false)
      await cargar()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta estación?')) return
    await supabase.from('estaciones').delete().eq('id', id)
    await cargar()
  }

  async function toggleEstado(est: Estacion) {
    const nuevo = est.estado === 'activa' ? 'inactiva' : 'activa'
    await supabase.from('estaciones').update({ estado: nuevo }).eq('id', est.id)
    await cargar()
  }

  const filtradas = estaciones.filter(e => {
    const matchNombre = e.nombre.toLowerCase().includes(filtro.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || e.estado === filtroEstado
    return matchNombre && matchEstado
  })

  const badgeVariant = (estado: EstacionEstado) =>
    estado === 'activa' ? 'success' : estado === 'mantenimiento' ? 'warning' : 'destructive'

  const estadoLabel = (estado: EstacionEstado) =>
    ({ activa: 'Activa', inactiva: 'Inactiva', mantenimiento: 'Mantenimiento' })[estado]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estaciones</h1>
          <p className="text-gray-500 text-sm">Administración de estaciones de bicicletas</p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus size={16} /> Nueva Estación
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <Input placeholder="Buscar por nombre..." className="pl-9"
                value={filtro} onChange={e => setFiltro(e.target.value)} />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="activa">Activas</SelectItem>
                <SelectItem value="inactiva">Inactivas</SelectItem>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Capacidad</TableHead>
                <TableHead>Coordenadas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No se encontraron estaciones
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map(est => (
                <TableRow key={est.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-gray-400" />
                      {est.nombre}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400" />
                      {est.direccion}
                    </div>
                  </TableCell>
                  <TableCell>{est.capacidad} bicis</TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {est.latitud.toFixed(4)}, {est.longitud.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(est.estado)}>{estadoLabel(est.estado)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleEstado(est)}>
                        {est.estado === 'activa' ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(est)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => eliminar(est.id)}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Estación' : 'Nueva Estación'}</DialogTitle>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitud</Label>
                <Input type="number" step="any" placeholder="4.7110" value={form.latitud}
                  onChange={e => setForm(p => ({ ...p, latitud: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Longitud</Label>
                <Input type="number" step="any" placeholder="-74.0721" value={form.longitud}
                  onChange={e => setForm(p => ({ ...p, longitud: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacidad</Label>
                <Input type="number" min="1" value={form.capacidad}
                  onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm(p => ({ ...p, estado: v as EstacionEstado }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="inactiva">Inactiva</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
