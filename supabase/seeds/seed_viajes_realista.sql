-- ==============================================================
-- CicloBici — Seed REALISTA: regenera los viajes de los 10
-- ciudadanos con demanda DIFERENCIADA por estación:
--   · Estaciones populares y estaciones poco usadas
--   · Perfiles horarios distintos (mañaneras / mediodía / tarde)
--   · 12 meses de historial (Jul 2025 – Jun 2026)
-- ⚠ BORRA los viajes seed anteriores (solo de estos 10 usuarios)
--   y los regenera. Los waypoints se regeneran también.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================

-- ─── 0. Limpiar viajes seed anteriores ───────────────────────
DELETE FROM viaje_waypoints WHERE viaje_id IN (
  SELECT id FROM viajes WHERE usuario_id IN (
    'a0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000009','a0000001-0000-0000-0000-000000000010'
  )
);
DELETE FROM viajes WHERE usuario_id IN (
  'a0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000006',
  'a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000008',
  'a0000001-0000-0000-0000-000000000009','a0000001-0000-0000-0000-000000000010'
);

-- ─── 1. Regenerar 12 meses con demanda realista ──────────────
DO $$
DECLARE
  uids UUID[] := ARRAY[
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'a0000001-0000-0000-0000-000000000004'::UUID,
    'a0000001-0000-0000-0000-000000000005'::UUID,
    'a0000001-0000-0000-0000-000000000006'::UUID,
    'a0000001-0000-0000-0000-000000000007'::UUID,
    'a0000001-0000-0000-0000-000000000008'::UUID,
    'a0000001-0000-0000-0000-000000000009'::UUID,
    'a0000001-0000-0000-0000-000000000010'::UUID
  ];
  -- Más viajes/mes por usuario para tener señal estadística
  trips_pm INT[] := ARRAY[12, 8, 10, 7, 14, 8, 10, 7, 12, 8];

  est_ids   UUID[];
  bici_ids  UUID[];
  n_est     INT;
  n_bici    INT;

  uid       UUID;
  v_id      UUID;
  orig_pos  INT;
  dest_pos  INT;
  orig_id   UUID;
  dest_id   UUID;
  bici_id   UUID;
  orig_lat  FLOAT8;
  orig_lng  FLOAT8;
  dest_lat  FLOAT8;
  dest_lng  FLOAT8;
  inicio_ts TIMESTAMPTZ;
  dur       INT;
  hora_lima INT;
  r         FLOAT8;
  calif     SMALLINT;
  ui        INT;
  mi        INT;
  ti        INT;
  wp        INT;
BEGIN
  -- Mismo orden que usa la API (ORDER BY nombre)
  SELECT ARRAY(SELECT id FROM estaciones WHERE estado IN ('activa','mantenimiento') ORDER BY nombre) INTO est_ids;
  SELECT ARRAY(SELECT id FROM bicicletas ORDER BY codigo) INTO bici_ids;
  n_est  := array_length(est_ids,  1);
  n_bici := array_length(bici_ids, 1);

  IF n_est < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 estaciones activas';
  END IF;

  ui := 1;
  FOREACH uid IN ARRAY uids LOOP
    FOR mi IN 0..11 LOOP   -- Jul 2025 (0) … Jun 2026 (11)
      FOR ti IN 1..trips_pm[ui] LOOP

        -- ── Estación ORIGEN con popularidad sesgada ──────────
        -- power(random(), 2.2) concentra los viajes en las
        -- primeras estaciones (alfabéticamente): unas muy
        -- concurridas, otras casi sin uso.
        orig_pos := 1 + LEAST(n_est - 1, floor(power(random(), 2.2) * n_est)::INT);
        dest_pos := 1 + (floor(random() * n_est))::INT;
        WHILE dest_pos = orig_pos LOOP
          dest_pos := 1 + (floor(random() * n_est))::INT;
        END LOOP;
        orig_id := est_ids[orig_pos];
        dest_id := est_ids[dest_pos];

        bici_id := bici_ids[1 + (floor(random() * n_bici))::INT];

        -- ── Perfil horario según la estación ────────────────
        -- Tercio 1 (populares): mañaneras — corredor laboral
        -- Tercio 2: mediodía / mixtas
        -- Tercio 3: tarde / recreativas
        r := random();
        IF orig_pos <= n_est / 3 THEN
          hora_lima := CASE WHEN r < 0.60 THEN 7 + (floor(random()*3))::INT    -- 7-9
                            WHEN r < 0.80 THEN 12 + (floor(random()*2))::INT   -- 12-13
                            ELSE               17 + (floor(random()*3))::INT   -- 17-19
                       END;
        ELSIF orig_pos <= 2 * n_est / 3 THEN
          hora_lima := CASE WHEN r < 0.25 THEN 7 + (floor(random()*3))::INT
                            WHEN r < 0.70 THEN 11 + (floor(random()*4))::INT   -- 11-14
                            ELSE               17 + (floor(random()*3))::INT
                       END;
        ELSE
          hora_lima := CASE WHEN r < 0.15 THEN 8 + (floor(random()*2))::INT
                            WHEN r < 0.35 THEN 12 + (floor(random()*2))::INT
                            ELSE               16 + (floor(random()*4))::INT   -- 16-19
                       END;
        END IF;

        -- Guardar en UTC (Lima + 5)
        inicio_ts := ('2025-07-01 00:00:00+00'::TIMESTAMPTZ
          + (mi || ' months')::INTERVAL
          + ((floor(random() * 27))::INT || ' days')::INTERVAL
          + ((hora_lima + 5) || ' hours')::INTERVAL
          + ((floor(random() * 60))::INT || ' minutes')::INTERVAL);

        dur   := 5 + (floor(random() * 50))::INT;
        calif := CASE WHEN random() < 0.70
                   THEN (3 + floor(random() * 3))::SMALLINT
                   ELSE NULL
                 END;

        SELECT latitud, longitud INTO orig_lat, orig_lng FROM estaciones WHERE id = orig_id;
        SELECT latitud, longitud INTO dest_lat, dest_lng FROM estaciones WHERE id = dest_id;

        v_id := gen_random_uuid();
        INSERT INTO viajes (
          id, usuario_id, bicicleta_id,
          estacion_origen_id, estacion_destino_id,
          inicio_at, fin_at,
          duracion_min, distancia_km, calificacion, estado
        ) VALUES (
          v_id, uid, bici_id, orig_id, dest_id,
          inicio_ts,
          inicio_ts + (dur || ' minutes')::INTERVAL,
          dur,
          round((dur * 0.18)::NUMERIC, 1),
          calif,
          'finalizado'
        );

        FOR wp IN 0..5 LOOP
          INSERT INTO viaje_waypoints (viaje_id, lat, lng, recorded_at) VALUES (
            v_id,
            orig_lat + (dest_lat - orig_lat) * (wp::FLOAT8 / 5.0)
              + CASE WHEN wp IN (1,2,3,4) THEN (random() - 0.5) * 0.002 ELSE 0 END,
            orig_lng + (dest_lng - orig_lng) * (wp::FLOAT8 / 5.0)
              + CASE WHEN wp IN (1,2,3,4) THEN (random() - 0.5) * 0.002 ELSE 0 END,
            inicio_ts + ((dur * 60 * wp / 5)::INT || ' seconds')::INTERVAL
          );
        END LOOP;

      END LOOP;
    END LOOP;
    ui := ui + 1;
  END LOOP;

  RAISE NOTICE 'Seed realista completado: 12 meses con demanda diferenciada por estación.';
END $$;
