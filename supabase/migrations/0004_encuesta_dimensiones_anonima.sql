-- ============================================================
-- San Borja en Bici — migración: encuesta multi-dimensión (SUS por
-- Seguridad/Funcionalidad/Rendimiento/Integridad, además de Usabilidad
-- general) y respuestas anónimas desde el login.
-- Cópialo y ejecútalo en Supabase Dashboard → SQL Editor → Run.
-- ============================================================

alter table public.encuestas_usabilidad
  add column if not exists dimension text not null default 'usabilidad'
    check (dimension in ('usabilidad', 'seguridad', 'funcionalidad', 'rendimiento', 'integridad'));

-- Permite respuestas anónimas: rol puede ser 'anonimo' además de los roles reales.
alter table public.encuestas_usabilidad drop constraint if exists encuestas_usabilidad_rol_check;

-- nps ahora es opcional (las encuestas por dimensión no preguntan NPS, solo la de Usabilidad general).
alter table public.encuestas_usabilidad alter column nps drop not null;
alter table public.encuestas_usabilidad drop constraint if exists encuestas_usabilidad_nps_check;
alter table public.encuestas_usabilidad add constraint encuestas_usabilidad_nps_check
  check (nps is null or nps between 0 and 10);
