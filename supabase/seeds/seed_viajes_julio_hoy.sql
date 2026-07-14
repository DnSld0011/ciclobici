-- ==============================================================
-- CicloBici — Seed: viajes del 1 de julio 2026 hasta HOY
-- Rellena los días sin actividad con 18-30 viajes/día realistas:
--   · Popularidad por estación (mismas reglas del seed realista)
--   · Perfiles horarios (mañaneras / mediodía / tarde)
--   · Waypoints GPS por viaje, calificaciones, duraciones
--   · Hoy solo genera viajes hasta la hora actual
-- No borra nada — solo agrega. Ejecutar en Supabase SQL Editor.
-- ==============================================================

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

  est_ids    UUID[];
  bici_ids   UUID[];
  n_est      INT;
  n_bici     INT;

  dia        DATE;
  hoy_lima   DATE;
  hora_ahora INT;              -- hora actual de Lima
  es_finde   BOOLEAN;
  viajes_dia INT;

  uid        UUID;
  v_id       UUID;
  orig_pos   INT;
  dest_pos   INT;
  orig_id    UUID;
  dest_id    UUID;
  bici_id    UUID;
  orig_lat   FLOAT8;
  orig_lng   FLOAT8;
  dest_lat   FLOAT8;
  dest_lng   FLOAT8;
  inicio_ts  TIMESTAMPTZ;
  dur        INT;
  hora_lima  INT;
  r          FLOAT8;
  calif      SMALLINT;
  ti         INT;
  wp         INT;
  creados    INT := 0;
BEGIN
  SELECT ARRAY(SELECT id FROM estaciones WHERE estado IN ('activa','mantenimiento') ORDER BY nombre) INTO est_ids;
  SELECT ARRAY(SELECT id FROM bicicletas ORDER BY codigo) INTO bici_ids;
  n_est  := array_length(est_ids,  1);
  n_bici := array_length(bici_ids, 1);

  IF n_est < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 estaciones activas';
  END IF;

  -- Fecha y hora actuales en Lima (UTC-5)
  hoy_lima   := (now() AT TIME ZONE 'America/Lima')::DATE;
  hora_ahora := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Lima'))::INT;

  -- ── Día por día: 1 de julio 2026 → hoy ──────────────────────
  dia := '2026-07-01';
  WHILE dia <= hoy_lima LOOP

    es_finde   := EXTRACT(DOW FROM dia) IN (0, 6);
    -- Laboral: 22-30 viajes · Fin de semana: 18-24
    viajes_dia := CASE WHEN es_finde
                    THEN 18 + floor(random() * 7)::INT
                    ELSE 22 + floor(random() * 9)::INT
                  END;

    FOR ti IN 1..viajes_dia LOOP

      -- Usuario aleatorio (pueden repetir varias veces al día)
      uid := uids[1 + floor(random() * 10)::INT];

      -- Estación origen con popularidad sesgada (igual que seed realista)
      orig_pos := 1 + LEAST(n_est - 1, floor(power(random(), 2.2) * n_est)::INT);
      dest_pos := 1 + (floor(random() * n_est))::INT;
      WHILE dest_pos = orig_pos LOOP
        dest_pos := 1 + (floor(random() * n_est))::INT;
      END LOOP;
      orig_id := est_ids[orig_pos];
      dest_id := est_ids[dest_pos];

      bici_id := bici_ids[1 + (floor(random() * n_bici))::INT];

      -- Perfil horario según estación
      r := random();
      IF orig_pos <= n_est / 3 THEN
        hora_lima := CASE WHEN r < 0.60 THEN 7 + (floor(random()*3))::INT
                          WHEN r < 0.80 THEN 12 + (floor(random()*2))::INT
                          ELSE               17 + (floor(random()*3))::INT
                     END;
      ELSIF orig_pos <= 2 * n_est / 3 THEN
        hora_lima := CASE WHEN r < 0.25 THEN 7 + (floor(random()*3))::INT
                          WHEN r < 0.70 THEN 11 + (floor(random()*4))::INT
                          ELSE               17 + (floor(random()*3))::INT
                     END;
      ELSE
        hora_lima := CASE WHEN r < 0.15 THEN 8 + (floor(random()*2))::INT
                          WHEN r < 0.35 THEN 12 + (floor(random()*2))::INT
                          ELSE               16 + (floor(random()*4))::INT
                     END;
      END IF;

      -- Hoy: no generar viajes de horas que aún no llegan
      IF dia = hoy_lima AND hora_lima > hora_ahora - 1 THEN
        CONTINUE;
      END IF;

      -- Timestamp en UTC (hora Lima + 5)
      inicio_ts := (dia::TIMESTAMPTZ
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

      creados := creados + 1;
    END LOOP;

    RAISE NOTICE '% → viajes generados', dia;
    dia := dia + 1;
  END LOOP;

  RAISE NOTICE 'Completado: % viajes creados del 1 de julio hasta hoy.', creados;
END $$;
