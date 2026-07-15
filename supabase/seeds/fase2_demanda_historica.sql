-- ==============================================================
-- CicloBici — FASE 2: Memoria de demanda del sistema
-- Tabla donde se consolida automáticamente, día a día, la demanda
-- REAL por estación y hora junto con lo que el modelo PREDIJO.
-- El sistema la llena solo (no requiere jobs): cada vez que se
-- consulta la predicción, consolida los días cerrados pendientes.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================

CREATE TABLE IF NOT EXISTS demanda_historica (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estacion_id      uuid NOT NULL REFERENCES estaciones(id) ON DELETE CASCADE,
  fecha            date NOT NULL,
  hora             smallint NOT NULL CHECK (hora BETWEEN 0 AND 23),
  viajes_reales    int NOT NULL DEFAULT 0,
  viajes_predichos numeric(6,2),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (estacion_id, fecha, hora)
);

CREATE INDEX IF NOT EXISTS idx_demanda_historica_fecha ON demanda_historica(fecha);

-- Solo el servidor (service role) escribe/lee esta tabla
ALTER TABLE demanda_historica ENABLE ROW LEVEL SECURITY;
