-- ============================================================
-- San Borja en Bici — migración: favoritos, calificación y push
-- Cópialo y ejecútalo en Supabase Dashboard → SQL Editor → Run
-- Es seguro volver a correrlo (usa IF NOT EXISTS / DROP...CREATE).
-- ============================================================

-- 1) Estaciones favoritas (casa / trabajo) ---------------------
alter table usuarios
  add column if not exists estacion_casa_id uuid references estaciones(id) on delete set null,
  add column if not exists estacion_trabajo_id uuid references estaciones(id) on delete set null;

-- 2) Calificación del viaje (1 a 5 estrellas) -------------------
alter table viajes
  add column if not exists calificacion smallint check (calificacion between 1 and 5);

-- El ciudadano debe poder calificar su propio viaje ya finalizado
-- desde el cliente (no solo desde el servidor con service role).
drop policy if exists "usuarios_actualizan_calificacion_propia" on viajes;
create policy "usuarios_actualizan_calificacion_propia"
  on viajes for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- 3) Suscripciones a notificaciones push -------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "usuarios_gestionan_su_suscripcion" on push_subscriptions;
create policy "usuarios_gestionan_su_suscripcion"
  on push_subscriptions for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
