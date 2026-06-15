-- ============================================================
-- CicloBici — Migración 001
-- Nuevas tablas: incidencias, alertas
-- Mejoras: viajes (distancia_km, duracion_min), bicicletas (qr_code)
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. ALTER TABLE bicicletas — agregar qr_code único por bici
-- ------------------------------------------------------------
ALTER TABLE public.bicicletas
  ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Generar qr_code para bicis existentes que no tienen
UPDATE public.bicicletas
  SET qr_code = 'QR-' || UPPER(SUBSTRING(id::text, 1, 8))
  WHERE qr_code IS NULL;

-- Hacer qr_code NOT NULL después de poblar
ALTER TABLE public.bicicletas
  ALTER COLUMN qr_code SET NOT NULL;

-- ------------------------------------------------------------
-- 2. ALTER TABLE viajes — agregar distancia y duración
-- ------------------------------------------------------------
ALTER TABLE public.viajes
  ADD COLUMN IF NOT EXISTS distancia_km  NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duracion_min  INTEGER       DEFAULT NULL;

-- Poblar duración para viajes históricos ya existentes
UPDATE public.viajes
  SET duracion_min = EXTRACT(EPOCH FROM (fin_at - inicio_at)) / 60
  WHERE fin_at IS NOT NULL AND duracion_min IS NULL;

-- ------------------------------------------------------------
-- 3. CREATE TABLE incidencias
-- Ciudadano reporta una bicicleta dañada.
-- El técnico puede convertirla en un registro de mantenimiento.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bicicleta_id    UUID REFERENCES public.bicicletas(id) ON DELETE SET NULL,
  usuario_id      UUID REFERENCES public.usuarios(id)   ON DELETE SET NULL,
  estacion_id     UUID REFERENCES public.estaciones(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN (
                    'frenos','llanta','cadena','manillar','asiento',
                    'iluminacion','electrico','estructura','otro'
                  )),
  descripcion     TEXT,
  foto_url        TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','en_revision','resuelta','descartada')),
  mantenimiento_id UUID REFERENCES public.mantenimientos(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_incidencias_bicicleta   ON public.incidencias(bicicleta_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado       ON public.incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_usuario      ON public.incidencias(usuario_id);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incidencias_updated_at ON public.incidencias;
CREATE TRIGGER trg_incidencias_updated_at
  BEFORE UPDATE ON public.incidencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ------------------------------------------------------------
-- 4. CREATE TABLE alertas
-- Generadas automáticamente por triggers o por el sistema.
-- Leídas y gestionadas por el operador.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alertas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         TEXT NOT NULL CHECK (tipo IN (
                 'saturacion','vacia','mantenimiento_urgente',
                 'bici_sin_retornar','stock_bajo','sistema'
               )),
  nivel        TEXT NOT NULL DEFAULT 'info'
               CHECK (nivel IN ('info','warning','critica')),
  titulo       TEXT NOT NULL,
  mensaje      TEXT,
  estacion_id  UUID REFERENCES public.estaciones(id) ON DELETE CASCADE,
  bicicleta_id UUID REFERENCES public.bicicletas(id) ON DELETE CASCADE,
  leida        BOOLEAN NOT NULL DEFAULT false,
  resuelta     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_leida     ON public.alertas(leida);
CREATE INDEX IF NOT EXISTS idx_alertas_nivel     ON public.alertas(nivel);
CREATE INDEX IF NOT EXISTS idx_alertas_created   ON public.alertas(created_at DESC);

-- ------------------------------------------------------------
-- 5. TRIGGER: generar alerta automática al actualizar bicicletas
-- Cuando una estación llega al 90%+ capacidad → alerta saturacion
-- Cuando una estación llega a 0 disponibles → alerta vacia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_alerta_disponibilidad()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_disponibles  INTEGER;
  v_capacidad    INTEGER;
  v_pct          NUMERIC;
  v_est_id       UUID;
  v_est_nombre   TEXT;
BEGIN
  -- Determinar la estación afectada (origen o nueva estación de la bici)
  v_est_id := COALESCE(NEW.estacion_id, OLD.estacion_id);
  IF v_est_id IS NULL THEN RETURN NEW; END IF;

  SELECT capacidad, nombre INTO v_capacidad, v_est_nombre
    FROM public.estaciones WHERE id = v_est_id;

  SELECT COUNT(*) INTO v_disponibles
    FROM public.bicicletas
    WHERE estacion_id = v_est_id AND estado = 'disponible';

  IF v_capacidad IS NULL OR v_capacidad = 0 THEN RETURN NEW; END IF;
  v_pct := (v_disponibles::NUMERIC / v_capacidad) * 100;

  -- Alerta SATURACIÓN: más del 90% lleno (pocas bicis disponibles)
  IF v_pct >= 90 THEN
    INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    VALUES (
      'saturacion', 'critica',
      'Saturación en ' || v_est_nombre,
      'La estación tiene ' || v_disponibles || '/' || v_capacidad || ' bicis (' || ROUND(v_pct) || '% ocupado). Considerar redistribución inmediata.',
      v_est_id
    )
    ON CONFLICT DO NOTHING;

  -- Alerta VACÍA: 0 bicis disponibles
  ELSIF v_disponibles = 0 THEN
    INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    VALUES (
      'vacia', 'critica',
      'Estación vacía: ' || v_est_nombre,
      'No hay bicis disponibles en esta estación. Tiempo estimado de recuperación natural: 45 min.',
      v_est_id
    )
    ON CONFLICT DO NOTHING;

  -- Alerta STOCK BAJO: menos del 20%
  ELSIF v_pct <= 20 THEN
    INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    VALUES (
      'stock_bajo', 'warning',
      'Stock bajo en ' || v_est_nombre,
      'Solo ' || v_disponibles || ' bici(s) disponible(s) (' || ROUND(v_pct) || '%). Monitorear.',
      v_est_id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerta_disponibilidad ON public.bicicletas;
CREATE TRIGGER trg_alerta_disponibilidad
  AFTER UPDATE OF estado, estacion_id ON public.bicicletas
  FOR EACH ROW EXECUTE FUNCTION public.fn_alerta_disponibilidad();

-- ------------------------------------------------------------
-- 6. TRIGGER: calcular duracion_min y distancia_km al finalizar viaje
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_finalizar_viaje()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fin_at IS NOT NULL AND OLD.fin_at IS NULL THEN
    NEW.duracion_min := ROUND(EXTRACT(EPOCH FROM (NEW.fin_at - NEW.inicio_at)) / 60)::INTEGER;
    -- Distancia aproximada: 12 km/h promedio
    NEW.distancia_km := ROUND((NEW.duracion_min::NUMERIC / 60.0) * 12.0, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalizar_viaje ON public.viajes;
CREATE TRIGGER trg_finalizar_viaje
  BEFORE UPDATE OF fin_at ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.fn_finalizar_viaje();

-- ------------------------------------------------------------
-- 7. RLS (Row Level Security) para las nuevas tablas
-- ------------------------------------------------------------

-- incidencias: el ciudadano solo ve las suyas; operador/tecnico ve todo
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ciudadano_ve_sus_incidencias"  ON public.incidencias;
DROP POLICY IF EXISTS "staff_ve_todas_las_incidencias" ON public.incidencias;
DROP POLICY IF EXISTS "ciudadano_crea_incidencias"     ON public.incidencias;

CREATE POLICY "ciudadano_ve_sus_incidencias" ON public.incidencias
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('operador','tecnico')
    )
  );

CREATE POLICY "ciudadano_crea_incidencias" ON public.incidencias
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "staff_actualiza_incidencias" ON public.incidencias
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('operador','tecnico')
    )
  );

-- alertas: solo operador/tecnico puede ver y marcar como leída
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_ve_alertas" ON public.alertas;
CREATE POLICY "staff_ve_alertas" ON public.alertas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('operador','tecnico')
    )
  );

-- ------------------------------------------------------------
-- 8. Datos de prueba para incidencias y alertas
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bici1 UUID;
  v_bici2 UUID;
  v_est1  UUID;
  v_ciudadano UUID;
BEGIN
  SELECT id INTO v_bici1 FROM public.bicicletas ORDER BY created_at LIMIT 1;
  SELECT id INTO v_bici2 FROM public.bicicletas ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO v_est1  FROM public.estaciones WHERE estado = 'activa' LIMIT 1;
  SELECT id INTO v_ciudadano FROM public.usuarios WHERE rol = 'ciudadano' LIMIT 1;

  INSERT INTO public.incidencias (bicicleta_id, usuario_id, estacion_id, tipo, descripcion, estado)
  VALUES
    (v_bici1, v_ciudadano, v_est1, 'frenos',   'El freno delantero no responde bien, peligroso', 'pendiente'),
    (v_bici2, v_ciudadano, v_est1, 'llanta',   'Llanta trasera pinchada, no se puede usar',      'en_revision');

  INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
  VALUES
    ('stock_bajo', 'warning',  'Stock bajo detectado',        'Estación con menos del 20% de disponibilidad.', v_est1),
    ('sistema',    'info',     'Sistema iniciado correctamente', 'CicloBici v1.0 operativo en San Borja.',       NULL);
END;
$$;

-- ------------------------------------------------------------
-- RESUMEN
-- ------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 001 completada';
  RAISE NOTICE '   + bicicletas.qr_code (TEXT UNIQUE NOT NULL)';
  RAISE NOTICE '   + viajes.distancia_km, viajes.duracion_min';
  RAISE NOTICE '   + tabla incidencias (con RLS)';
  RAISE NOTICE '   + tabla alertas (con RLS)';
  RAISE NOTICE '   + trigger fn_alerta_disponibilidad';
  RAISE NOTICE '   + trigger fn_finalizar_viaje';
  RAISE NOTICE '   + 2 incidencias de prueba';
  RAISE NOTICE '   + 2 alertas de prueba';
END;
$$;
