-- ============================================================
-- CicloBici — Migración 004
-- 1. Ampliar constraint de rol en usuarios
-- 2. Crear tabla roles con vistas por rol
-- ============================================================

-- 1. Quitar constraint antiguo y agregar 'administrador'
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('ciudadano', 'operador', 'tecnico', 'administrador'));

-- 2. Crear tabla de roles
CREATE TABLE IF NOT EXISTS public.roles (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  color       TEXT DEFAULT '#6b7280',
  vistas      TEXT[] DEFAULT '{}',
  es_sistema  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Roles predeterminados
INSERT INTO public.roles (id, nombre, descripcion, color, vistas, es_sistema) VALUES
(
  'ciudadano', 'Ciudadano',
  'Usuario final que usa las bicicletas compartidas',
  '#166534',
  ARRAY['/ciudadano','/ciudadano/mapa','/ciudadano/viajes','/ciudadano/escanear','/ciudadano/perfil'],
  true
),
(
  'operador', 'Operador',
  'Gestión y monitoreo del sistema de bicicletas',
  '#1d4ed8',
  ARRAY['/operador','/operador/viajes-en-vivo','/operador/mapa','/operador/alertas',
        '/operador/estaciones','/operador/bicicletas','/operador/mantenimiento',
        '/operador/prediccion','/operador/usuarios'],
  true
),
(
  'tecnico', 'Técnico',
  'Mantenimiento de bicicletas y estaciones',
  '#92400e',
  ARRAY['/tecnico/mantenimiento','/tecnico/bicicletas','/tecnico/incidencias','/tecnico/historial'],
  true
),
(
  'administrador', 'Administrador',
  'Acceso total al sistema — gestión de roles y usuarios',
  '#7c3aed',
  ARRAY['/operador','/operador/viajes-en-vivo','/operador/mapa','/operador/alertas',
        '/operador/estaciones','/operador/bicicletas','/operador/mantenimiento',
        '/operador/prediccion','/operador/usuarios','/operador/roles',
        '/tecnico/mantenimiento','/tecnico/bicicletas','/tecnico/incidencias','/tecnico/historial',
        '/ciudadano','/ciudadano/mapa','/ciudadano/viajes'],
  true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Habilitar RLS en la tabla roles (solo lectura pública, escritura por servicio)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "roles_select_all" ON public.roles
  FOR SELECT USING (true);
