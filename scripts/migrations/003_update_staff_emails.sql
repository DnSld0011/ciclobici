-- ============================================================
-- CicloBici — Migración 003
-- Actualizar correos de usuarios staff en la tabla pública.
-- IMPORTANTE: Los correos en auth.users deben coincidir.
-- Ejecutar DESPUÉS de configurar los correos reales en
-- Supabase Dashboard → Authentication → Users.
-- ============================================================

-- Actualizar correos en la tabla pública de usuarios
-- (ajusta los correos a los reales que usarás)
UPDATE public.usuarios
  SET correo = 'operador@ciclobici.pe'
  WHERE rol = 'operador'
    AND (correo IS NULL OR correo = '' OR correo LIKE '%example%');

UPDATE public.usuarios
  SET correo = 'tecnico@ciclobici.pe'
  WHERE rol = 'tecnico'
    AND (correo IS NULL OR correo = '' OR correo LIKE '%example%');

-- Verificar resultado
SELECT id, nombre, rol, correo, estado
FROM public.usuarios
ORDER BY rol, nombre;
