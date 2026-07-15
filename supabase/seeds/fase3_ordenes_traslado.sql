-- ==============================================================
-- CicloBici — FASE 3: Órdenes de traslado de bicicletas
-- El operador designa técnicos para mover bicis entre estaciones
-- (o desde el depósito) según lo que indica la predicción.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================

CREATE TABLE IF NOT EXISTS ordenes_traslado (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = las bicis salen del depósito central (no de una estación)
  estacion_origen_id  uuid REFERENCES estaciones(id) ON DELETE SET NULL,
  estacion_destino_id uuid NOT NULL REFERENCES estaciones(id) ON DELETE CASCADE,
  cantidad            int  NOT NULL CHECK (cantidad > 0),
  bicis_trasladadas   int  NOT NULL DEFAULT 0,
  tecnico_id          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  estado              text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),
  notas               text,
  fecha_objetivo      date,
  created_at          timestamptz DEFAULT now(),
  completada_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ordenes_traslado_estado  ON ordenes_traslado(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_traslado_tecnico ON ordenes_traslado(tecnico_id);

ALTER TABLE ordenes_traslado ENABLE ROW LEVEL SECURITY;

-- El técnico puede ver sus propias órdenes desde su sesión
DROP POLICY IF EXISTS "tecnico_ve_sus_ordenes" ON ordenes_traslado;
CREATE POLICY "tecnico_ve_sus_ordenes" ON ordenes_traslado
  FOR SELECT USING (tecnico_id = auth.uid());
