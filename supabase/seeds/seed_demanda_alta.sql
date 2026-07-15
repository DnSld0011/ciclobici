-- ==============================================================
-- CicloBici — Seed DEMANDA ALTA: últimos 28 días con viajes en
-- TODAS las estaciones y niveles diferenciados:
--   · Estaciones top (3 primeras):    25–30 viajes/día
--   · Estaciones medias (siguientes 5): 12–18 viajes/día
--   · Estaciones bajas (el resto):      8–12 viajes/día
-- ⚠ BORRA los viajes de los últimos 28 días de los 10 ciudadanos
--   seed y los regenera (con waypoints GPS). No toca nada más.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================

-- ─── 0. Limpiar los últimos 28 días (solo usuarios seed) ─────
DELETE FROM viaje_waypoints WHERE viaje_id IN (
  SELECT id FROM viajes
  WHERE inicio_at >= now() - interval '28 days'
    AND usuario_id IN (
      'a0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002',
      'a0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000004',
      'a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000006',
      'a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000008',
      'a0000001-0000-0000-0000-000000000009','a0000001-0000-0000-0000-000000000010'
    )
);
DELETE FROM viajes
WHERE inicio_at >= now() - interval '28 days'
  AND estado = 'finalizado'
  AND usuario_id IN (
    'a0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000009','a0000001-0000-0000-0000-000000000010'
  );

-- ─── 1. Regenerar 28 días con demanda alta y diferenciada ────
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
  hora_ahora INT;
  es_finde   BOOLEAN;

  ei         INT;
  viajes_est INT;
  uid        UUID;
  v_id       UUID;
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

  hoy_lima   := (now() AT TIME ZONE 'America/Lima')::DATE;
  hora_ahora := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Lima'))::INT;

  dia := hoy_lima - 27;
  WHILE dia <= hoy_lima LOOP
    es_finde := EXTRACT(DOW FROM dia) IN (0, 6);

    -- Recorrer TODAS las estaciones como origen
    FOR ei IN 1..n_est LOOP

      -- Nivel de demanda según posición (alfabética)
      IF ei <= 3 THEN
        viajes_est := 25 + floor(random() * 6)::INT;   -- top: 25-30/día
      ELSIF ei <= 8 THEN
        viajes_est := 12 + floor(random() * 7)::INT;   -- media: 12-18/día
      ELSE
        viajes_est := 8 + floor(random() * 5)::INT;    -- baja: 8-12/día
      END IF;
      -- Fin de semana: ~25% menos
      IF es_finde THEN viajes_est := GREATEST(4, (viajes_est * 3) / 4); END IF;

      FOR ti IN 1..viajes_est LOOP
        uid := uids[1 + floor(random() * 10)::INT];

        orig_id  := est_ids[ei];
        dest_pos := 1 + (floor(random() * n_est))::INT;
        WHILE dest_pos = ei LOOP
          dest_pos := 1 + (floor(random() * n_est))::INT;
        END LOOP;
        dest_id := est_ids[dest_pos];

        bici_id := bici_ids[1 + (floor(random() * n_bici))::INT];

        -- Perfil horario: top = mañanero, media = mediodía, baja = tarde
        r := random();
        IF ei <= 3 THEN
          hora_lima := CASE WHEN r < 0.45 THEN 7 + (floor(random()*3))::INT     -- 7-9
                            WHEN r < 0.65 THEN 11 + (floor(random()*4))::INT    -- 11-14
                            WHEN r < 0.90 THEN 16 + (floor(random()*4))::INT    -- 16-19
                            ELSE               10 + (floor(random()*11))::INT   -- resto
                       END;
        ELSIF ei <= 8 THEN
          hora_lima := CASE WHEN r < 0.25 THEN 7 + (floor(random()*3))::INT
                            WHEN r < 0.65 THEN 11 + (floor(random()*4))::INT
                            WHEN r < 0.90 THEN 16 + (floor(random()*4))::INT
                            ELSE               9 + (floor(random()*12))::INT
                       END;
        ELSE
          hora_lima := CASE WHEN r < 0.15 THEN 8 + (floor(random()*2))::INT
                            WHEN r < 0.40 THEN 11 + (floor(random()*4))::INT
                            WHEN r < 0.90 THEN 15 + (floor(random()*5))::INT    -- 15-19
                            ELSE               20 + (floor(random()*2))::INT
                       END;
        END IF;
        hora_lima := LEAST(21, GREATEST(5, hora_lima));

        -- Hoy: solo horas ya transcurridas
        IF dia = hoy_lima AND hora_lima > hora_ahora - 1 THEN
          CONTINUE;
        END IF;

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
    END LOOP;

    dia := dia + 1;
  END LOOP;

  RAISE NOTICE 'Completado: % viajes creados en los últimos 28 días.', creados;
END $$;
