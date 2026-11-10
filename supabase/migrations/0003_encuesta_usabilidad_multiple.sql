-- ============================================================
-- San Borja en Bici — migración: permitir varias respuestas por
-- cuenta en la encuesta de usabilidad (modo "kiosko": distintas
-- personas reales responden desde el mismo dispositivo/sesión).
-- Cópialo y ejecútalo en Supabase Dashboard → SQL Editor → Run.
-- ============================================================

drop index if exists public.encuestas_usabilidad_usuario_unico;
