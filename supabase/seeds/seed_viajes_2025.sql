-- ==============================================================
-- CicloBici — Seed: viajes Julio–Diciembre 2025 para los 10
-- ciudadanos ya registrados (completa 1 año de historial junto
-- con el seed anterior de Enero–Junio 2026).
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Requiere haber ejecutado antes seed_ciudadanos.sql
-- ==============================================================

-- ─── 0. Retroceder fecha de registro de los ciudadanos a 1 año ─
UPDATE usuarios
SET created_at = '2025-07-01 12:00:00+00'
WHERE id IN (
  'a0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005',
  'a0000001-0000-0000-0000-000000000006',
  'a0000001-0000-0000-0000-000000000007',
  'a0000001-0000-0000-0000-000000000008',
  'a0000001-0000-0000-0000-000000000009',
  'a0000001-0000-0000-0000-000000000010'
) AND created_at > '2025-07-01 12:00:00+00';

-- ─── 1. Viajes + waypoints GPS (Julio–Diciembre 2025) ─────────
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
  -- Viajes por mes por usuario (mismo perfil que el seed anterior)
  trips_pm INT[] := ARRAY[6, 4, 5, 3, 7, 4, 5, 3, 6, 4];

  est_ids   UUID[];
  bici_ids  UUID[];
  n_est     INT;
  n_bici    INT;

  uid       UUID;
  v_id      UUID;
  orig_id   UUID;
  dest_id   UUID;
  bici_id   UUID;
  orig_lat  FLOAT8;
  orig_lng  FLOAT8;
  dest_lat  FLOAT8;
  dest_lng  FLOAT8;
  inicio_ts TIMESTAMPTZ;
  dur       INT;
  hora_utc  INT;
  calif     SMALLINT;
  ui        INT;
  mi        INT;
  ti        INT;
  wp        INT;
BEGIN
  SELECT ARRAY(SELECT id FROM estaciones WHERE estado IN ('activa','mantenimiento') ORDER BY nombre) INTO est_ids;
  SELECT ARRAY(SELECT id FROM bicicletas ORDER BY codigo) INTO bici_ids;
  n_est  := array_length(est_ids,  1);
  n_bici := array_length(bici_ids, 1);

  IF n_est < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 estaciones activas';
  END IF;

  ui := 1;
  FOREACH uid IN ARRAY uids LOOP
    FOR mi IN 0..5 LOOP   -- 0=Julio, 1=Agosto, ..., 5=Diciembre 2025

      FOR ti IN 1..trips_pm[ui] LOOP

        orig_id := est_ids[1 + (floor(random() * n_est))::INT];
        dest_id := est_ids[1 + (floor(random() * n_est))::INT];
        WHILE dest_id = orig_id LOOP
          dest_id := est_ids[1 + (floor(random() * n_est))::INT];
        END LOOP;

        bici_id := bici_ids[1 + (floor(random() * n_bici))::INT];

        -- Hora pico realista en Lima (UTC-5 → se suma 5 para guardar en UTC)
        hora_utc := CASE (floor(random() * 3))::INT
          WHEN 0 THEN  7 + (floor(random() * 2))::INT + 5   -- 7-9 Lima → 12-14 UTC
          WHEN 1 THEN 12 + (floor(random() * 2))::INT + 5   -- 12-14 Lima → 17-19 UTC
          ELSE         17 + (floor(random() * 2))::INT + 5  -- 17-19 Lima → 22-00 UTC
        END;

        inicio_ts := ('2025-07-01 00:00:00+00'::TIMESTAMPTZ
          + (mi || ' months')::INTERVAL
          + ((floor(random() * 27))::INT || ' days')::INTERVAL
          + (hora_utc || ' hours')::INTERVAL
          + ((floor(random() * 60))::INT || ' minutes')::INTERVAL);

        dur   := 5 + (floor(random() * 50))::INT;  -- 5-55 min
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

        -- 6 waypoints por viaje
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

  RAISE NOTICE 'Seed 2025 completado: viajes Jul-Dic 2025 generados con waypoints GPS.';
END $$;
