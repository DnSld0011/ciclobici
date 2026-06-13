'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Estacion, PrediccionHora } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, Info } from 'lucide-react'

export default function PrediccionPage() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [estacionId, setEstacionId] = useState('')
  const [intervalo, setIntervalo] = useState('3')
  const [datos, setDatos] = useState<PrediccionHora[]>([])
  const [loading, setLoading] = useState(false)
  const [sinDatos, setSinDatos] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('estaciones').select('*').eq('estado', 'activa').order('nombre')
      .then(({ data }) => { if (data) setEstaciones(data) })
  }, [])

  useEffect(() => {
    if (!estacionId) return
    consultar()
  }, [estacionId, intervalo])

  async function consultar() {
    setLoading(true)
    setSinDatos(false)
    try {
      const res = await fetch(`/api/prediccion?estacion_id=${estacionId}&intervalo=${intervalo}`)
      const json = await res.json()
      if (json.sin_datos) {
        setSinDatos(true)
        setDatos([])
      } else {
        setDatos(json.prediccion ?? [])
      }
    } catch {
      setSinDatos(true)
    } finally {
      setLoading(false)
    }
  }

  const estacionSeleccionada = estaciones.find(e => e.id === estacionId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Predicción de Demanda</h1>
        <p className="text-gray-500 text-sm">Disponibilidad proyectada basada en datos históricos</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1 flex-1 min-w-48">
              <Label>Estación</Label>
              <Select value={estacionId} onValueChange={setEstacionId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estación..." /></SelectTrigger>
                <SelectContent>
                  {estaciones.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-36">
              <Label>Intervalo</Label>
              <Select value={intervalo} onValueChange={setIntervalo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Próxima 1h</SelectItem>
                  <SelectItem value="3">Próximas 3h</SelectItem>
                  <SelectItem value="6">Próximas 6h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!estacionId && (
        <Alert variant="info">
          <Info size={16} />
          <AlertDescription>Selecciona una estación para ver la predicción de demanda.</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
      )}

      {sinDatos && !loading && (
        <Alert variant="warning">
          <TrendingUp size={16} />
          <AlertDescription>
            <strong>Modelo en entrenamiento:</strong> No hay suficientes datos históricos de viajes para esta estación.
            La predicción estará disponible una vez que se registren más viajes.
          </AlertDescription>
        </Alert>
      )}

      {datos.length > 0 && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-700" />
              Demanda Proyectada — {estacionSeleccionada?.nombre}
            </CardTitle>
            <CardDescription>
              Próximas {intervalo}h · Capacidad: {estacionSeleccionada?.capacidad} bicicletas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={datos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora_label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [
                    value as number,
                    name === 'demanda_estimada' ? 'Demanda Estimada' : 'Capacidad'
                  ]}
                />
                <Legend
                  formatter={(value) => value === 'demanda_estimada' ? 'Demanda Estimada' : 'Capacidad Total'}
                />
                <ReferenceLine y={estacionSeleccionada?.capacidad} stroke="#DC2626" strokeDasharray="5 5" label={{ value: 'Capacidad', fontSize: 11 }} />
                <Bar dataKey="demanda_estimada" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacidad" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <strong>Nota:</strong> La demanda estimada se calcula usando el promedio histórico de viajes
              por hora y día de semana. Mayor demanda indica mayor necesidad de bicicletas disponibles.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
