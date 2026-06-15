-- ============================================================
-- CicloBici — Migración 004
-- ============================================================

-- 1. Ampliar constraint de rol
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('ciudadano', 'operador', 'tecnico', 'administrador'));

-- 2. Crear tabla roles
CREATE TABLE IF NOT EXISTS public.roles (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  color       TEXT DEFAULT '#6b7280',
  vistas      TEXT[] DEFAULT '{}',
  es_sistema  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Insertar roles base
INSERT INTO public.roles (id, nombre, descripcion, color, vistas, es_sistema) VALUES
('ciudadano','Ciudadano','Usuario final del sistema','#166534',
  ARRAY['/ciudadano','/ciudadano/mapa','/ciudadano/viajes','/ciudadano/escanear','/ciudadano/perfil'], true),
('operador','Operador','Gestión y monitoreo del sistema','#1d4ed8',
  ARRAY['/operador','/operador/viajes-en-vivo','/operador/mapa','/operador/alertas',
        '/operador/estaciones','/operador/bicicletas','/operador/mantenimiento',
        '/operador/prediccion','/operador/usuarios'], true),
('tecnico','Técnico','Mantenimiento de bicicletas y estaciones','#92400e',
  ARRAY['/tecnico/mantenimiento','/tecnico/bicicletas','/tecnico/incidencias','/tecnico/historial'], true),
('administrador','Administrador','Acceso total al sistema','#7c3aed',
  ARRAY['/operador','/operador/viajes-en-vivo','/operador/mapa','/operador/alertas',
        '/operador/estaciones','/operador/bicicletas','/operador/mantenimiento',
        '/operador/prediccion','/operador/usuarios','/operador/roles',
        '/tecnico/mantenimiento','/tecnico/bicicletas','/tecnico/incidencias','/tecnico/historial',
        '/ciudadano','/ciudadano/mapa','/ciudadano/viajes'], true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS — eliminar política si existe y recrear
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON public.roles;
CREATE POLICY "roles_select" ON public.roles FOR SELECT USING (true);

-- 5. Tu usuario → administrador
UPDATE public.usuarios SET rol = 'administrador' WHERE correo = 'dardiles.msb@gmail.com';
