-- ============================================================
-- CicloBici — Script de datos de prueba
-- Localidad: Perú (+51)
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

DO $$
DECLARE
  -- UUIDs usuarios
  uid_operador  uuid := gen_random_uuid();
  uid_tecnico   uuid := gen_random_uuid();
  uid_maria     uuid := gen_random_uuid();
  uid_juan      uuid := gen_random_uuid();
  uid_laura     uuid := gen_random_uuid();

  -- UUIDs estaciones
  est_1 uuid := gen_random_uuid();
  est_2 uuid := gen_random_uuid();
  est_3 uuid := gen_random_uuid();
  est_4 uuid := gen_random_uuid();
  est_5 uuid := gen_random_uuid();
  est_6 uuid := gen_random_uuid();

  -- UUIDs bicicletas
  b01 uuid := gen_random_uuid(); b02 uuid := gen_random_uuid();
  b03 uuid := gen_random_uuid(); b04 uuid := gen_random_uuid();
  b05 uuid := gen_random_uuid(); b06 uuid := gen_random_uuid();
  b07 uuid := gen_random_uuid(); b08 uuid := gen_random_uuid();
  b09 uuid := gen_random_uuid(); b10 uuid := gen_random_uuid();
  b11 uuid := gen_random_uuid(); b12 uuid := gen_random_uuid();
  b13 uuid := gen_random_uuid(); b14 uuid := gen_random_uuid();
  b15 uuid := gen_random_uuid(); b16 uuid := gen_random_uuid();
  b17 uuid := gen_random_uuid(); b18 uuid := gen_random_uuid();
  b19 uuid := gen_random_uuid(); b20 uuid := gen_random_uuid();

  today text := to_char(now(), 'YYYYMMDD');

BEGIN

-- ============================================================
-- 1. AUTH USERS (con teléfono peruano +51)
-- ============================================================

INSERT INTO auth.users
  (id, instance_id, aud, role, phone, phone_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  (uid_operador, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '+519001000001', now(), '{"provider":"phone","providers":["phone"]}', '{}',
   now(), now(), '', '', '', ''),
  (uid_tecnico,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '+519001000002', now(), '{"provider":"phone","providers":["phone"]}', '{}',
   now(), now(), '', '', '', ''),
  (uid_maria,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '+519001000003', now(), '{"provider":"phone","providers":["phone"]}', '{}',
   now(), now(), '', '', '', ''),
  (uid_juan,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '+519001000004', now(), '{"provider":"phone","providers":["phone"]}', '{}',
   now(), now(), '', '', '', ''),
  (uid_laura,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '+519001000005', now(), '{"provider":"phone","providers":["phone"]}', '{}',
   now(), now(), '', '', '', '');

-- ============================================================
-- 2. AUTH IDENTITIES
-- ============================================================

INSERT INTO auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  (uid_operador::text, uid_operador, json_build_object('sub', uid_operador::text, 'phone', '+519001000001'), 'phone', '+519001000001', now(), now(), now()),
  (uid_tecnico::text,  uid_tecnico,  json_build_object('sub', uid_tecnico::text,  'phone', '+519001000002'), 'phone', '+519001000002', now(), now(), now()),
  (uid_maria::text,    uid_maria,    json_build_object('sub', uid_maria::text,    'phone', '+519001000003'), 'phone', '+519001000003', now(), now(), now()),
  (uid_juan::text,     uid_juan,     json_build_object('sub', uid_juan::text,     'phone', '+519001000004'), 'phone', '+519001000004', now(), now(), now()),
  (uid_laura::text,    uid_laura,    json_build_object('sub', uid_laura::text,    'phone', '+519001000005'), 'phone', '+519001000005', now(), now(), now());

-- ============================================================
-- 3. PERFILES DE USUARIOS
-- ============================================================

INSERT INTO public.usuarios (id, nombre, documento, correo, celular, rol, estado) VALUES
  (uid_operador, 'Admin Operador',  '10000001', 'operador@ciclobici.pe', '9001000001', 'operador',  'activo'),
  (uid_tecnico,  'Carlos Técnico',  '10000002', 'tecnico@ciclobici.pe',  '9001000002', 'tecnico',   'activo'),
  (uid_maria,    'María Ciudadana', '10000003', 'maria@example.pe',      '9001000003', 'ciudadano', 'activo'),
  (uid_juan,     'Juan Ciudadano',  '10000004', 'juan@example.pe',       '9001000004', 'ciudadano', 'activo'),
  (uid_laura,    'Laura Usuario',   '10000005', 'laura@example.pe',      '9001000005', 'ciudadano', 'activo');

-- ============================================================
-- 4. ESTACIONES (Lima, Perú)
-- ============================================================

INSERT INTO public.estaciones (id, nombre, direccion, latitud, longitud, capacidad, estado) VALUES
  (est_1, 'Estación San Borja Norte', 'Av. San Borja Norte 1200, San Borja, Lima',  -12.0960, -76.9980, 15, 'activa'),
  (est_2, 'Estación San Borja Sur',  'Av. San Borja Sur 780, San Borja, Lima',      -12.1080, -76.9990, 12, 'activa'),
  (est_3, 'Estación Aviación',       'Av. Aviación 2850, San Borja, Lima',          -12.1020, -77.0050, 10, 'activa'),
  (est_4, 'Estación Javier Prado',   'Av. Javier Prado Este 3200, San Borja, Lima', -12.0970, -76.9940, 12, 'activa'),
  (est_5, 'Estación Canadá',         'Av. Canadá 1450, San Borja, Lima',            -12.1050, -77.0010, 8,  'mantenimiento'),
  (est_6, 'Estación Angamos',        'Av. Angamos Este 1800, San Borja, Lima',      -12.1100, -76.9960, 10, 'activa');

-- ============================================================
-- 5. BICICLETAS (20 unidades)
-- ============================================================

INSERT INTO public.bicicletas (id, codigo, tipo, marca, modelo, qr_code, estado, estacion_id) VALUES
  (b01, 'BC-' || today || '-0001', 'Urbana',    'Trek',       'FX3',          'QR-' || UPPER(SUBSTRING(b01::text, 1, 8)), 'disponible',   est_1),
  (b02, 'BC-' || today || '-0002', 'Urbana',    'Giant',      'Escape 3',     'QR-' || UPPER(SUBSTRING(b02::text, 1, 8)), 'disponible',   est_1),
  (b03, 'BC-' || today || '-0003', 'Urbana',    'Trek',       'FX2',          'QR-' || UPPER(SUBSTRING(b03::text, 1, 8)), 'disponible',   est_1),
  (b04, 'BC-' || today || '-0004', 'MTB',       'Trek',       'Marlin 5',     'QR-' || UPPER(SUBSTRING(b04::text, 1, 8)), 'disponible',   est_2),
  (b05, 'BC-' || today || '-0005', 'Urbana',    'Bianchi',    'C-Sport 2',    'QR-' || UPPER(SUBSTRING(b05::text, 1, 8)), 'disponible',   est_2),
  (b06, 'BC-' || today || '-0006', 'Urbana',    'Giant',      'Escape 2',     'QR-' || UPPER(SUBSTRING(b06::text, 1, 8)), 'disponible',   est_2),
  (b07, 'BC-' || today || '-0007', 'Eléctrica', 'Specialized','Turbo Vado',   'QR-' || UPPER(SUBSTRING(b07::text, 1, 8)), 'disponible',   est_3),
  (b08, 'BC-' || today || '-0008', 'Urbana',    'Trek',       'FX3',          'QR-' || UPPER(SUBSTRING(b08::text, 1, 8)), 'disponible',   est_3),
  (b09, 'BC-' || today || '-0009', 'Urbana',    'Cannondale', 'Quick 4',      'QR-' || UPPER(SUBSTRING(b09::text, 1, 8)), 'disponible',   est_3),
  (b10, 'BC-' || today || '-0010', 'MTB',       'Scott',      'Aspect 950',   'QR-' || UPPER(SUBSTRING(b10::text, 1, 8)), 'disponible',   est_4),
  (b11, 'BC-' || today || '-0011', 'Urbana',    'Trek',       'FX1',          'QR-' || UPPER(SUBSTRING(b11::text, 1, 8)), 'disponible',   est_4),
  (b12, 'BC-' || today || '-0012', 'Urbana',    'Giant',      'Fastroad AR2', 'QR-' || UPPER(SUBSTRING(b12::text, 1, 8)), 'disponible',   est_4),
  (b13, 'BC-' || today || '-0013', 'Eléctrica', 'Trek',       'Verve+ 2',     'QR-' || UPPER(SUBSTRING(b13::text, 1, 8)), 'disponible',   est_6),
  (b14, 'BC-' || today || '-0014', 'Urbana',    'Cannondale', 'Quick 3',      'QR-' || UPPER(SUBSTRING(b14::text, 1, 8)), 'disponible',   est_6),
  (b15, 'BC-' || today || '-0015', 'MTB',       'Giant',      'Talon 3',      'QR-' || UPPER(SUBSTRING(b15::text, 1, 8)), 'disponible',   est_6),
  (b16, 'BC-' || today || '-0016', 'Urbana',    'Bianchi',    'C-Sport 1',    'QR-' || UPPER(SUBSTRING(b16::text, 1, 8)), 'en_viaje',     est_1),
  (b17, 'BC-' || today || '-0017', 'Urbana',    'Trek',       'FX2',          'QR-' || UPPER(SUBSTRING(b17::text, 1, 8)), 'en_viaje',     est_2),
  (b18, 'BC-' || today || '-0018', 'MTB',       'Scott',      'Aspect 760',   'QR-' || UPPER(SUBSTRING(b18::text, 1, 8)), 'mantenimiento',NULL),
  (b19, 'BC-' || today || '-0019', 'Urbana',    'Giant',      'Escape 1',     'QR-' || UPPER(SUBSTRING(b19::text, 1, 8)), 'mantenimiento',NULL),
  (b20, 'BC-' || today || '-0020', 'Eléctrica', 'Specialized','Turbo Como',   'QR-' || UPPER(SUBSTRING(b20::text, 1, 8)), 'baja',         NULL);

-- ============================================================
-- 6. MANTENIMIENTOS
-- ============================================================

INSERT INTO public.mantenimientos (bicicleta_id, tipo_intervencion, descripcion, responsable, fecha) VALUES
  (b18, 'Reparación de Frenos',    'Cambio de pastillas de freno delantero y trasero', 'Carlos Técnico',  now() - interval '1 day'),
  (b19, 'Cambio de Neumático',     'Neumático trasero pinchado, reemplazo completo',   'Carlos Técnico',  now() - interval '2 days'),
  (b01, 'Mantenimiento Preventivo','Revisión general, lubricación y ajuste de frenos', 'Ana Martínez',    now() - interval '5 days'),
  (b04, 'Lubricación de Cadena',   'Limpieza y lubricación completa de transmisión',   'Pedro Gómez',     now() - interval '7 days'),
  (b07, 'Revisión Eléctrica',      'Revisión de batería y motor eléctrico, OK',        'Carlos Técnico',  now() - interval '10 days'),
  (b10, 'Ajuste de Marcha',        'Ajuste de cambios y desviadores',                  'Ana Martínez',    now() - interval '12 days'),
  (b13, 'Revisión Eléctrica',      'Actualización de firmware del motor',              'Pedro Gómez',     now() - interval '15 days'),
  (b02, 'Revisión General',        'Revisión completa antes de temporada alta',        'Carlos Técnico',  now() - interval '20 days');

-- ============================================================
-- 7. VIAJES HISTÓRICOS (últimos 30 días para predicción)
-- ============================================================

INSERT INTO public.viajes (usuario_id, bicicleta_id, estacion_origen_id, estacion_destino_id, inicio_at, fin_at, estado)
SELECT
  CASE (random() * 2)::int
    WHEN 0 THEN uid_maria
    WHEN 1 THEN uid_juan
    ELSE        uid_laura
  END,
  CASE (random() * 14)::int
    WHEN 0 THEN b01 WHEN 1 THEN b02 WHEN 2 THEN b03
    WHEN 3 THEN b04 WHEN 4 THEN b05 WHEN 5 THEN b06
    WHEN 6 THEN b07 WHEN 7 THEN b08 WHEN 8 THEN b09
    WHEN 9 THEN b10 WHEN 10 THEN b11 WHEN 11 THEN b12
    WHEN 12 THEN b13 WHEN 13 THEN b14 ELSE b15
  END,
  CASE (random() * 4)::int
    WHEN 0 THEN est_1 WHEN 1 THEN est_2 WHEN 2 THEN est_3 WHEN 3 THEN est_4 ELSE est_6
  END,
  CASE (random() * 4)::int
    WHEN 0 THEN est_2 WHEN 1 THEN est_3 WHEN 2 THEN est_4 WHEN 3 THEN est_6 ELSE est_1
  END,
  -- Fechas distribuidas en los últimos 30 días con horarios pico realistas
  (now() - (random() * 30)::int * interval '1 day'
         - interval '1 hour' * (ARRAY[7,8,9,12,13,17,18,19,20])[(random() * 8)::int + 1]
         + interval '1 minute' * (random() * 60)::int),
  (now() - (random() * 30)::int * interval '1 day'
         - interval '1 hour' * (ARRAY[7,8,9,12,13,17,18,19,20])[(random() * 8)::int + 1]
         + interval '1 minute' * (random() * 60 + 15)::int),
  'finalizado'
FROM generate_series(1, 500);

-- ============================================================
-- RESUMEN
-- ============================================================

RAISE NOTICE '✅ Seed completado exitosamente';
RAISE NOTICE '════════════════════════════════════════';
RAISE NOTICE 'USUARIOS DE PRUEBA (inicio de sesión por celular):';
RAISE NOTICE '  Operador  → +519001000001';
RAISE NOTICE '  Técnico   → +519001000002';
RAISE NOTICE '  Ciudadano → +519001000003 (María)';
RAISE NOTICE '  Ciudadano → +519001000004 (Juan)';
RAISE NOTICE '  Ciudadano → +519001000005 (Laura)';
RAISE NOTICE '════════════════════════════════════════';
RAISE NOTICE 'DATOS CREADOS:';
RAISE NOTICE '  6 estaciones en Lima';
RAISE NOTICE '  20 bicicletas (15 disponibles, 2 en viaje, 2 mant., 1 baja)';
RAISE NOTICE '  8 mantenimientos';
RAISE NOTICE '  500 viajes históricos para el modelo predictivo';
RAISE NOTICE '════════════════════════════════════════';
RAISE NOTICE 'OTP para pruebas: Supabase → Authentication → Logs';

END $$;
