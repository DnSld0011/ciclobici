-- ==============================================================
-- CicloBici — Seed: 10 ciudadanos reales + 6 meses de viajes + waypoints GPS
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Contraseña de TODOS los usuarios: CicloBici2024!
-- Seguro de correr más de una vez (ON CONFLICT DO NOTHING en todo)
-- ==============================================================

-- ─── 0. Tabla waypoints (si aún no existe) ────────────────────
CREATE TABLE IF NOT EXISTS viaje_waypoints (
  id          uuid             DEFAULT gen_random_uuid() PRIMARY KEY,
  viaje_id    uuid             NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  recorded_at timestamptz      DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viaje_waypoints_viaje_id ON viaje_waypoints(viaje_id);

-- ─── 1. Usuarios en auth.users ────────────────────────────────
-- (requiere permisos de servicio — OK desde SQL Editor)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('a0000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'ana.flores.sb@gmail.com',   crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Ana Flores Quispe"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'carlos.mendoza.sb@gmail.com', crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Carlos Mendoza Rivas"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'lucia.torres.sb@gmail.com',   crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Lucía Torres Vargas"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'diego.huaman.sb@gmail.com',   crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Diego Huamán Paredes"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'valeria.soto.sb@gmail.com',   crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Valeria Soto Chávez"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'sebastian.rios.sb@gmail.com', crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Sebastián Ríos Castillo"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'camila.aguilar.sb@gmail.com', crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Camila Aguilar León"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'matias.delgado.sb@gmail.com', crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Matías Delgado Fuentes"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fernanda.nunez.sb@gmail.com', crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Fernanda Núñez Cruz"}'::jsonb,
   now(), now(), '', '', '', ''),
  ('a0000001-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'rafael.campos.sb@gmail.com',  crypt('CicloBici2024!',gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Rafael Campos Vera"}'::jsonb,
   now(), now(), '', '', '', '')
ON CONFLICT DO NOTHING;

-- ─── 2. Identidades (necesario para login email/password) ─────
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000001','ana.flores.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000001","email":"ana.flores.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000002','carlos.mendoza.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000002","email":"carlos.mendoza.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000003','lucia.torres.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000003","email":"lucia.torres.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000004','diego.huaman.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000004","email":"diego.huaman.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000005','valeria.soto.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000005","email":"valeria.soto.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000006','sebastian.rios.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000006","email":"sebastian.rios.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000007','camila.aguilar.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000007","email":"camila.aguilar.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000008','matias.delgado.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000008","email":"matias.delgado.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000009','fernanda.nunez.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000009","email":"fernanda.nunez.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(),'a0000001-0000-0000-0000-000000000010','rafael.campos.sb@gmail.com',
   '{"sub":"a0000001-0000-0000-0000-000000000010","email":"rafael.campos.sb@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- ─── 3. Perfil público en tabla usuarios ─────────────────────
INSERT INTO usuarios (id, nombre, email, rol, estado, created_at) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Ana Flores Quispe',      'ana.flores.sb@gmail.com',    'ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000002', 'Carlos Mendoza Rivas',   'carlos.mendoza.sb@gmail.com','ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000003', 'Lucía Torres Vargas',    'lucia.torres.sb@gmail.com',  'ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000004', 'Diego Huamán Paredes',   'diego.huaman.sb@gmail.com',  'ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000005', 'Valeria Soto Chávez',    'valeria.soto.sb@gmail.com',  'ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000006', 'Sebastián Ríos Castillo','sebastian.rios.sb@gmail.com','ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000007', 'Camila Aguilar León',    'camila.aguilar.sb@gmail.com','ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000008', 'Matías Delgado Fuentes', 'matias.delgado.sb@gmail.com','ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000009', 'Fernanda Núñez Cruz',    'fernanda.nunez.sb@gmail.com','ciudadano', 'activo', now() - interval '6 months'),
  ('a0000001-0000-0000-0000-000000000010', 'Rafael Campos Vera',     'rafael.campos.sb@gmail.com', 'ciudadano', 'activo', now() - interval '6 months')
ON CONFLICT DO NOTHING;

-- ─── 4. Viajes + waypoints GPS (6 meses, Enero–Junio 2026) ───
DO $$
DECLARE
  -- IDs fijos de los 10 ciudadanos
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
  -- Viajes por mes por usuario (varía el perfil de uso)
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
  -- Cargar estaciones activas y bicis disponibles
  SELECT ARRAY(SELECT id FROM estaciones WHERE estado IN ('activa','mantenimiento') ORDER BY nombre) INTO est_ids;
  SELECT ARRAY(SELECT id FROM bicicletas ORDER BY codigo) INTO bici_ids;
  n_est  := array_length(est_ids,  1);
  n_bici := array_length(bici_ids, 1);

  IF n_est < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 estaciones activas';
  END IF;

  ui := 1;
  FOREACH uid IN ARRAY uids LOOP
    FOR mi IN 0..5 LOOP   -- 0=Enero, 1=Febrero, ..., 5=Junio 2026

      FOR ti IN 1..trips_pm[ui] LOOP

        -- Estación origen aleatoria
        orig_id := est_ids[1 + (floor(random() * n_est))::INT];
        dest_id := est_ids[1 + (floor(random() * n_est))::INT];
        WHILE dest_id = orig_id LOOP
          dest_id := est_ids[1 + (floor(random() * n_est))::INT];
        END LOOP;

        -- Bicicleta aleatoria
        bici_id := bici_ids[1 + (floor(random() * n_bici))::INT];

        -- Hora pico realista en Lima (UTC-5 → se suma 5 para guardar en UTC)
        -- Mañana 7-9h, mediodía 12-14h, tarde 17-19h
        hora_utc := CASE (floor(random() * 3))::INT
          WHEN 0 THEN  7 + (floor(random() * 2))::INT + 5   -- 7-9 Lima → 12-14 UTC
          WHEN 1 THEN 12 + (floor(random() * 2))::INT + 5   -- 12-14 Lima → 17-19 UTC
          ELSE         17 + (floor(random() * 2))::INT + 5  -- 17-19 Lima → 22-00 UTC
        END;

        inicio_ts := ('2026-01-01 00:00:00+00'::TIMESTAMPTZ
          + (mi || ' months')::INTERVAL
          + ((floor(random() * 27))::INT || ' days')::INTERVAL
          + (hora_utc || ' hours')::INTERVAL
          + ((floor(random() * 60))::INT || ' minutes')::INTERVAL);

        dur   := 5 + (floor(random() * 50))::INT;  -- 5-55 min
        calif := CASE WHEN random() < 0.70
                   THEN (3 + floor(random() * 3))::SMALLINT   -- 3, 4 o 5 estrellas
                   ELSE NULL
                 END;

        -- Coordenadas de las estaciones
        SELECT latitud, longitud INTO orig_lat, orig_lng FROM estaciones WHERE id = orig_id;
        SELECT latitud, longitud INTO dest_lat, dest_lng FROM estaciones WHERE id = dest_id;

        -- Insertar viaje finalizado
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
          round((dur * 0.18)::NUMERIC, 1),   -- ~10 km/h en bici urbana
          calif,
          'finalizado'
        );

        -- 6 waypoints por viaje: inicio, 4 intermedios con ruido de calle, fin
        FOR wp IN 0..5 LOOP
          INSERT INTO viaje_waypoints (viaje_id, lat, lng, recorded_at) VALUES (
            v_id,
            -- Interpolación lineal + ruido lateral (±0.002° ≈ 200m en Lima)
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

  RAISE NOTICE 'Seed completado: % usuarios, viajes generados con waypoints GPS.', array_length(uids, 1);
END $$;
