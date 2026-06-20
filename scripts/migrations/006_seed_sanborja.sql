-- ============================================================
-- CicloBici — Migración 006: Seed datos reales San Borja
-- Estaciones con coordenadas GPS reales + bicicletas + viajes históricos
-- Seguro de ejecutar varias veces (ON CONFLICT DO NOTHING)
-- ============================================================

DO $$
DECLARE
  -- Estaciones San Borja (coords GPS verificadas)
  est_nb  uuid; -- San Borja Norte
  est_sb  uuid; -- San Borja Sur
  est_av  uuid; -- Aviación
  est_jp  uuid; -- Javier Prado
  est_ca  uuid; -- Canadá
  est_an  uuid; -- Angamos
  est_ba  uuid; -- Basadre
  est_pc  uuid; -- Primavera Centro
  est_ar  uuid; -- Aramburu

  -- Bicis para viajes
  bici_ids uuid[];
  b_id uuid;
  i int;
  n int := 300; -- viajes históricos a generar

  uid_ciudadano uuid;

BEGIN

-- ── 1. Estaciones San Borja con GPS real ──────────────────────
INSERT INTO public.estaciones (id, nombre, direccion, latitud, longitud, capacidad, estado)
VALUES
  (gen_random_uuid(), 'Est. San Borja Norte',    'Av. San Borja Norte 1098, San Borja',   -12.0959, -76.9977, 15, 'activa'),
  (gen_random_uuid(), 'Est. San Borja Sur',       'Av. San Borja Sur 710, San Borja',      -12.1079, -76.9991, 12, 'activa'),
  (gen_random_uuid(), 'Est. Aviación - Javier P', 'Av. Aviación cdra 26, San Borja',       -12.0998, -77.0058, 10, 'activa'),
  (gen_random_uuid(), 'Est. Javier Prado Central','Av. Javier Prado Este 3200, San Borja', -12.0973, -76.9937, 14, 'activa'),
  (gen_random_uuid(), 'Est. Canadá',              'Av. Canadá 1510, San Borja',            -12.1049, -77.0009, 10, 'activa'),
  (gen_random_uuid(), 'Est. Angamos Este',        'Av. Angamos Este 1850, San Borja',      -12.1101, -76.9959, 10, 'activa'),
  (gen_random_uuid(), 'Est. Basadre',             'Av. General Basadre 910, San Borja',    -12.0910, -76.9970, 8,  'activa'),
  (gen_random_uuid(), 'Est. Primavera',           'Av. Primavera 1340, San Borja',         -12.1040, -76.9920, 12, 'activa'),
  (gen_random_uuid(), 'Est. Aramburu',            'Av. Aramburu 680, San Borja',           -12.0880, -76.9990, 10, 'activa')
ON CONFLICT DO NOTHING;

-- ── 2. Obtener IDs de estaciones para usar en viajes ──────────
SELECT id INTO est_nb FROM public.estaciones WHERE nombre = 'Est. San Borja Norte' LIMIT 1;
SELECT id INTO est_sb FROM public.estaciones WHERE nombre = 'Est. San Borja Sur' LIMIT 1;
SELECT id INTO est_av FROM public.estaciones WHERE nombre LIKE 'Est. Aviación%' LIMIT 1;
SELECT id INTO est_jp FROM public.estaciones WHERE nombre LIKE 'Est. Javier Prado%' LIMIT 1;
SELECT id INTO est_ca FROM public.estaciones WHERE nombre = 'Est. Canadá' LIMIT 1;
SELECT id INTO est_an FROM public.estaciones WHERE nombre LIKE 'Est. Angamos%' LIMIT 1;
SELECT id INTO est_ba FROM public.estaciones WHERE nombre LIKE 'Est. Basadre%' LIMIT 1;
SELECT id INTO est_pc FROM public.estaciones WHERE nombre LIKE 'Est. Primavera%' LIMIT 1;
SELECT id INTO est_ar FROM public.estaciones WHERE nombre LIKE 'Est. Aramburu%' LIMIT 1;

-- ── 3. Bicicletas adicionales con qr_code ─────────────────────
INSERT INTO public.bicicletas (id, codigo, tipo, marca, modelo, qr_code, estado, estacion_id)
VALUES
  (gen_random_uuid(), 'SB-001', 'Urbana',    'Trek',       'FX3',       'QR-SB001', 'disponible', est_nb),
  (gen_random_uuid(), 'SB-002', 'Urbana',    'Giant',      'Escape 3',  'QR-SB002', 'disponible', est_nb),
  (gen_random_uuid(), 'SB-003', 'Urbana',    'Trek',       'FX2',       'QR-SB003', 'disponible', est_nb),
  (gen_random_uuid(), 'SB-004', 'MTB',       'Trek',       'Marlin 5',  'QR-SB004', 'disponible', est_sb),
  (gen_random_uuid(), 'SB-005', 'Urbana',    'Bianchi',    'C-Sport 2', 'QR-SB005', 'disponible', est_sb),
  (gen_random_uuid(), 'SB-006', 'Urbana',    'Giant',      'Escape 2',  'QR-SB006', 'disponible', est_sb),
  (gen_random_uuid(), 'SB-007', 'Eléctrica', 'Specialized','Turbo Vado','QR-SB007', 'disponible', est_av),
  (gen_random_uuid(), 'SB-008', 'Urbana',    'Trek',       'FX3',       'QR-SB008', 'disponible', est_av),
  (gen_random_uuid(), 'SB-009', 'Urbana',    'Cannondale', 'Quick 4',   'QR-SB009', 'disponible', est_jp),
  (gen_random_uuid(), 'SB-010', 'MTB',       'Scott',      'Aspect 950','QR-SB010', 'disponible', est_jp),
  (gen_random_uuid(), 'SB-011', 'Urbana',    'Trek',       'FX1',       'QR-SB011', 'disponible', est_ca),
  (gen_random_uuid(), 'SB-012', 'Urbana',    'Giant',      'Fastroad',  'QR-SB012', 'disponible', est_ca),
  (gen_random_uuid(), 'SB-013', 'Eléctrica', 'Trek',       'Verve+ 2',  'QR-SB013', 'disponible', est_an),
  (gen_random_uuid(), 'SB-014', 'Urbana',    'Cannondale', 'Quick 3',   'QR-SB014', 'disponible', est_ba),
  (gen_random_uuid(), 'SB-015', 'MTB',       'Giant',      'Talon 3',   'QR-SB015', 'disponible', est_pc),
  (gen_random_uuid(), 'SB-016', 'Urbana',    'Trek',       'FX2',       'QR-SB016', 'disponible', est_ar),
  (gen_random_uuid(), 'SB-017', 'Eléctrica', 'Specialized','Turbo Como','QR-SB017', 'mantenimiento', NULL),
  (gen_random_uuid(), 'SB-018', 'Urbana',    'Giant',      'Escape 1',  'QR-SB018', 'disponible', est_nb)
ON CONFLICT (codigo) DO NOTHING;

-- ── 4. Viajes históricos con distribución horaria realista ────
-- Patrón pico: 7-9h (mañana), 12-13h (almuerzo), 17-20h (tarde)
SELECT id INTO uid_ciudadano FROM public.usuarios WHERE rol = 'ciudadano' LIMIT 1;

IF uid_ciudadano IS NULL THEN
  RAISE NOTICE 'No hay ciudadanos en BD, omitiendo viajes históricos';
ELSE
  -- Obtener array de bicicletas disponibles
  SELECT array_agg(id) INTO bici_ids FROM public.bicicletas WHERE estado = 'disponible' LIMIT 15;

  IF array_length(bici_ids, 1) > 0 THEN
    FOR i IN 1..n LOOP
      b_id := bici_ids[1 + (random() * (array_length(bici_ids, 1) - 1))::int];

      INSERT INTO public.viajes (
        usuario_id, bicicleta_id,
        estacion_origen_id, estacion_destino_id,
        inicio_at, fin_at, estado,
        distancia_km, duracion_min
      )
      SELECT
        uid_ciudadano,
        b_id,
        (ARRAY[est_nb, est_sb, est_av, est_jp, est_ca, est_an, est_ba, est_pc, est_ar])[1 + (random() * 8)::int],
        (ARRAY[est_nb, est_sb, est_av, est_jp, est_ca, est_an, est_ba, est_pc, est_ar])[1 + (random() * 8)::int],
        ts,
        ts + (dur * interval '1 minute'),
        'finalizado',
        round(((dur / 60.0) * 12.0)::numeric, 2),
        dur
      FROM (
        SELECT
          -- Distribución temporal: últimos 60 días con horarios pico
          now() - ((random() * 60)::int * interval '1 day')
            + ((ARRAY[7,7,8,8,8,9,12,13,17,17,18,18,19,20])[1 + (random() * 13)::int] * interval '1 hour')
            + ((random() * 60)::int * interval '1 minute') AS ts,
          (10 + (random() * 50)::int) AS dur
      ) t;
    END LOOP;
  END IF;
END IF;

RAISE NOTICE '✅ Migración 006 completada';
RAISE NOTICE '   + 9 estaciones San Borja con GPS real';
RAISE NOTICE '   + 18 bicicletas (con qr_code)';
RAISE NOTICE '   + % viajes históricos (últimos 60 días)', n;

END $$;
