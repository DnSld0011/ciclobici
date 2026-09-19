-- =========================================
-- CicloBici — Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor (en orden)
--
-- Este archivo es la ÚNICA fuente de verdad del schema (2026-09-18
-- se consolidó todo lo que vivía disperso en scripts/migrations/ y
-- supabase/migrations/ — ambas carpetas quedan solo como historial).
-- Los archivos en supabase/seeds/ siguen siendo válidos para cargar
-- datos de ejemplo, pero no crean nada de schema que no esté aquí.
--
-- Requiere además un bucket de Storage llamado "evidencias" (público
-- para lectura) creado manualmente en Supabase Dashboard → Storage,
-- usado para las fotos de incidencias reportadas por el ciudadano.
-- =========================================

-- 1. Tabla de Usuarios
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  documento text unique not null,
  correo text unique not null,
  celular text unique not null,
  estado text default 'pendiente' check (estado in ('pendiente', 'activo', 'suspendido')),
  rol text default 'ciudadano' check (rol in ('ciudadano', 'operador', 'tecnico', 'administrador')),
  created_at timestamptz default now()
);

-- 2. Tabla de Estaciones
create table if not exists public.estaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text not null,
  latitud float8 not null,
  longitud float8 not null,
  capacidad int not null check (capacidad > 0),
  foto_url text,
  estado text default 'activa' check (estado in ('activa', 'inactiva', 'mantenimiento')),
  created_at timestamptz default now()
);

-- Favoritos del ciudadano (requieren que estaciones ya exista)
alter table public.usuarios
  add column if not exists estacion_casa_id uuid references public.estaciones(id) on delete set null,
  add column if not exists estacion_trabajo_id uuid references public.estaciones(id) on delete set null;

-- 3. Tabla de Bicicletas
create table if not exists public.bicicletas (
  id          uuid   primary key default gen_random_uuid(),
  codigo      text   unique not null,
  tipo        text   not null,
  marca       text,
  modelo      text,
  qr_url      text,
  qr_code     text   unique,
  estado      text   default 'disponible' check (estado in ('disponible', 'en_viaje', 'mantenimiento', 'baja')),
  estacion_id uuid   references public.estaciones(id) on delete set null,
  created_at  timestamptz default now()
);

-- 4. Tabla de Mantenimientos
create table if not exists public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  bicicleta_id uuid references public.bicicletas(id) on delete cascade not null,
  tipo_intervencion text not null,
  descripcion text,
  responsable text not null,
  fecha timestamptz not null,
  created_at timestamptz default now()
);

-- 5. Tabla de Viajes (para modelo predictivo)
create table if not exists public.viajes (
  id                  uuid        primary key default gen_random_uuid(),
  usuario_id          uuid        references public.usuarios(id)   on delete set null,
  bicicleta_id        uuid        references public.bicicletas(id) on delete set null,
  estacion_origen_id  uuid        references public.estaciones(id) on delete set null,
  estacion_destino_id uuid        references public.estaciones(id) on delete set null,
  inicio_at           timestamptz default now(),
  fin_at              timestamptz,
  estado              text        default 'activo' check (estado in ('activo', 'finalizado', 'cancelado')),
  distancia_km        numeric(6,2) default null,
  duracion_min        integer      default null,
  lat                 double precision default null,
  lng                 double precision default null,
  calificacion        smallint     default null check (calificacion between 1 and 5)
);

-- 6. Tabla de Roles
create table if not exists public.roles (
  id          text        primary key,
  nombre      text        not null,
  descripcion text        default '',
  color       text        default '#6b7280',
  vistas      text[]      default '{}',
  es_sistema  boolean     default false,
  created_at  timestamptz default now()
);

-- 7. Tabla de Incidencias
-- Ciudadano reporta una bicicleta dañada; el técnico la resuelve.
create table if not exists public.incidencias (
  id               uuid        primary key default gen_random_uuid(),
  bicicleta_id     uuid        references public.bicicletas(id)   on delete set null,
  usuario_id       uuid        references public.usuarios(id)      on delete set null,
  estacion_id      uuid        references public.estaciones(id)    on delete set null,
  tipo             text        not null check (tipo in (
                     'frenos','llanta','cadena','manillar','asiento',
                     'iluminacion','electrico','estructura','otro'
                   )),
  descripcion      text,
  foto_url         text,
  estado           text        not null default 'pendiente'
                   check (estado in ('pendiente','en_revision','resuelta','descartada')),
  mantenimiento_id uuid        references public.mantenimientos(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_incidencias_bicicleta on public.incidencias(bicicleta_id);
create index if not exists idx_incidencias_estado    on public.incidencias(estado);
create index if not exists idx_incidencias_usuario   on public.incidencias(usuario_id);

-- Trigger: mantener updated_at al día
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_incidencias_updated_at on public.incidencias;
create trigger trg_incidencias_updated_at
  before update on public.incidencias
  for each row execute function public.fn_set_updated_at();

-- 8. Tabla de Alertas
-- Generadas por triggers automáticos o manualmente por el operador.
create table if not exists public.alertas (
  id           uuid        primary key default gen_random_uuid(),
  tipo         text        not null check (tipo in (
                 'saturacion','vacia','mantenimiento_urgente',
                 'bici_sin_retornar','stock_bajo','sistema'
               )),
  nivel        text        not null default 'info'
               check (nivel in ('info','warning','critica')),
  titulo       text        not null,
  mensaje      text,
  estacion_id  uuid        references public.estaciones(id) on delete cascade,
  bicicleta_id uuid        references public.bicicletas(id) on delete cascade,
  leida        boolean     not null default false,
  resuelta     boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_alertas_leida   on public.alertas(leida);
create index if not exists idx_alertas_nivel   on public.alertas(nivel);
create index if not exists idx_alertas_created on public.alertas(created_at desc);

-- Trigger: generar alerta automática al cambiar estado/estación de una bicicleta
create or replace function public.fn_alerta_disponibilidad()
returns trigger language plpgsql as $$
declare
  v_disponibles integer;
  v_capacidad   integer;
  v_pct         numeric;
  v_est_id      uuid;
  v_est_nombre  text;
begin
  v_est_id := coalesce(new.estacion_id, old.estacion_id);
  if v_est_id is null then return new; end if;

  select capacidad, nombre into v_capacidad, v_est_nombre
    from public.estaciones where id = v_est_id;

  select count(*) into v_disponibles
    from public.bicicletas
    where estacion_id = v_est_id and estado = 'disponible';

  if v_capacidad is null or v_capacidad = 0 then return new; end if;
  v_pct := (v_disponibles::numeric / v_capacidad) * 100;

  if v_pct >= 90 then
    insert into public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    values ('saturacion', 'critica',
      'Saturación en ' || v_est_nombre,
      'La estación tiene ' || v_disponibles || '/' || v_capacidad || ' bicis (' || round(v_pct) || '%). Redistribución recomendada.',
      v_est_id)
    on conflict do nothing;
  elsif v_disponibles = 0 then
    insert into public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    values ('vacia', 'critica',
      'Estación vacía: ' || v_est_nombre,
      'No hay bicis disponibles. Tiempo estimado de recuperación: 45 min.',
      v_est_id)
    on conflict do nothing;
  elsif v_pct <= 20 then
    insert into public.alertas (tipo, nivel, titulo, mensaje, estacion_id)
    values ('stock_bajo', 'warning',
      'Stock bajo en ' || v_est_nombre,
      'Solo ' || v_disponibles || ' bici(s) disponible(s) (' || round(v_pct) || '%). Monitorear.',
      v_est_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alerta_disponibilidad on public.bicicletas;
create trigger trg_alerta_disponibilidad
  after update of estado, estacion_id on public.bicicletas
  for each row execute function public.fn_alerta_disponibilidad();

-- Trigger: calcular duracion_min al finalizar viaje.
-- distancia_km solo se estima si el cliente no envió ya el dato real por GPS.
create or replace function public.fn_finalizar_viaje()
returns trigger language plpgsql as $$
begin
  if new.fin_at is not null and old.fin_at is null then
    new.duracion_min := round(extract(epoch from (new.fin_at - new.inicio_at)) / 60)::integer;
    if new.distancia_km is null then
      new.distancia_km := round((new.duracion_min::numeric / 60.0) * 10.0, 2);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finalizar_viaje on public.viajes;
create trigger trg_finalizar_viaje
  before update of fin_at on public.viajes
  for each row execute function public.fn_finalizar_viaje();

-- Trigger: alerta automática para viaje activo > 120 min
create or replace function public.fn_alerta_viaje_anormal()
returns trigger language plpgsql as $$
declare
  v_minutos  numeric;
  v_bici_cod text;
begin
  if new.estado != 'activo' or new.inicio_at is null then return new; end if;
  v_minutos := extract(epoch from (now() - new.inicio_at)) / 60;
  if v_minutos > 120 then
    select codigo into v_bici_cod from public.bicicletas where id = new.bicicleta_id;
    insert into public.alertas (tipo, nivel, titulo, mensaje, bicicleta_id)
    values ('bici_sin_retornar', 'critica',
      'Viaje anormal: ' || coalesce(v_bici_cod, 'bici desconocida'),
      'Lleva ' || round(v_minutos) || ' min activo sin finalizar. Posible incidencia o extravío.',
      new.bicicleta_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alerta_viaje_anormal on public.viajes;
create trigger trg_alerta_viaje_anormal
  after update on public.viajes
  for each row
  when (new.estado = 'activo')
  execute function public.fn_alerta_viaje_anormal();

-- Trigger: alerta para bici en mantenimiento > 7 días
create or replace function public.fn_alerta_mantenimiento_urgente()
returns trigger language plpgsql as $$
declare v_dias numeric;
begin
  if new.estado != 'mantenimiento' then return new; end if;
  select extract(epoch from (now() - m.fecha)) / 86400
    into v_dias from public.mantenimientos m
    where m.bicicleta_id = new.id order by m.fecha desc limit 1;
  if v_dias is not null and v_dias > 7 then
    insert into public.alertas (tipo, nivel, titulo, mensaje, bicicleta_id)
    values ('mantenimiento_urgente', 'warning',
      'Mantenimiento prolongado: ' || new.codigo,
      'La bicicleta lleva ' || round(v_dias) || ' días en mantenimiento. Revisar estado.',
      new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alerta_mantenimiento_urgente on public.bicicletas;
create trigger trg_alerta_mantenimiento_urgente
  after update of estado on public.bicicletas
  for each row
  when (new.estado = 'mantenimiento')
  execute function public.fn_alerta_mantenimiento_urgente();

-- 9. Tabla de Roles: registros base (id coincide con el check de usuarios.rol)
insert into public.roles (id, nombre, descripcion, color, vistas, es_sistema) values
  ('ciudadano', 'Ciudadano', 'Usuario final del sistema', '#166534',
    array['/ciudadano','/ciudadano/mapa','/ciudadano/viajes','/ciudadano/escanear',
          '/ciudadano/viaje','/ciudadano/viaje-activo','/ciudadano/incidencias',
          '/ciudadano/incidencias/historial','/ciudadano/perfil'], true),
  ('operador', 'Operador', 'Gestión y monitoreo del sistema', '#1d4ed8',
    array['/operador','/operador/viajes-en-vivo','/operador/viajes','/operador/traslados',
          '/operador/mapa','/operador/alertas','/operador/fallas','/operador/estaciones',
          '/operador/bicicletas','/operador/mantenimiento','/operador/asignacion',
          '/operador/prediccion'], true),
  ('tecnico', 'Técnico', 'Mantenimiento de bicicletas y estaciones', '#92400e',
    array['/tecnico/mantenimiento','/tecnico/traslados','/tecnico/bicicletas',
          '/tecnico/incidencias','/tecnico/historial'], true),
  ('administrador', 'Administrador', 'Acceso total al sistema', '#7c3aed',
    array['/operador','/operador/admin','/operador/viajes-en-vivo','/operador/viajes',
          '/operador/traslados','/operador/mapa','/operador/alertas','/operador/fallas',
          '/operador/estaciones','/operador/bicicletas','/operador/mantenimiento',
          '/operador/asignacion','/operador/prediccion','/operador/kpis','/operador/stock',
          '/operador/usuarios','/operador/roles'], true)
on conflict (id) do nothing;

-- 10. Tabla de Waypoints GPS por viaje (seguimiento en vivo + recorrido histórico)
create table if not exists public.viaje_waypoints (
  id          uuid             primary key default gen_random_uuid(),
  viaje_id    uuid             not null references public.viajes(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  recorded_at timestamptz      default now()
);
create index if not exists idx_viaje_waypoints_viaje_id on public.viaje_waypoints(viaje_id);

-- 11. Tabla de Órdenes de Traslado (operador designa técnicos según predicción de demanda)
create table if not exists public.ordenes_traslado (
  id                  uuid        primary key default gen_random_uuid(),
  -- NULL = las bicis salen del depósito central (no de una estación)
  estacion_origen_id  uuid        references public.estaciones(id) on delete set null,
  estacion_destino_id uuid        not null references public.estaciones(id) on delete cascade,
  cantidad            int         not null check (cantidad > 0),
  bicis_trasladadas   int         not null default 0,
  tecnico_id          uuid        references public.usuarios(id) on delete set null,
  creado_por          uuid        references public.usuarios(id) on delete set null,
  estado              text        not null default 'pendiente'
                      check (estado in ('pendiente', 'en_proceso', 'completada', 'cancelada')),
  notas               text,
  fecha_objetivo      date,
  created_at          timestamptz default now(),
  completada_at       timestamptz
);
create index if not exists idx_ordenes_traslado_estado  on public.ordenes_traslado(estado);
create index if not exists idx_ordenes_traslado_tecnico on public.ordenes_traslado(tecnico_id);

-- 12. Tabla de Memoria de Demanda (consolidación diaria real vs. predicha, por estación/hora)
create table if not exists public.demanda_historica (
  id               uuid        primary key default gen_random_uuid(),
  estacion_id      uuid        not null references public.estaciones(id) on delete cascade,
  fecha            date        not null,
  hora             smallint    not null check (hora between 0 and 23),
  viajes_reales    int         not null default 0,
  viajes_predichos numeric(6,2),
  created_at       timestamptz default now(),
  unique (estacion_id, fecha, hora)
);
create index if not exists idx_demanda_historica_fecha on public.demanda_historica(fecha);

-- 13. Tabla de Suscripciones Push (notificaciones web push al ciudadano)
create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  usuario_id uuid        not null references public.usuarios(id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);

-- =========================================
-- Row Level Security (RLS)
-- =========================================

alter table public.usuarios enable row level security;
alter table public.estaciones enable row level security;
alter table public.bicicletas enable row level security;
alter table public.mantenimientos enable row level security;
alter table public.viajes enable row level security;
alter table public.incidencias enable row level security;
alter table public.alertas enable row level security;
alter table public.viaje_waypoints enable row level security;
alter table public.ordenes_traslado enable row level security;
alter table public.demanda_historica enable row level security;
alter table public.push_subscriptions enable row level security;

-- Políticas: Usuarios
create policy "Usuarios: lectura propia" on public.usuarios
  for select using (auth.uid() = id);

create policy "Usuarios: inserción propia" on public.usuarios
  for insert with check (auth.uid() = id);

create policy "Usuarios: actualización propia" on public.usuarios
  for update using (auth.uid() = id);

-- Políticas: Estaciones (lectura pública autenticada, escritura operadores)
create policy "Estaciones: lectura autenticada" on public.estaciones
  for select using (auth.role() = 'authenticated');

create policy "Estaciones: gestión operadores" on public.estaciones
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Bicicletas (lectura pública autenticada, escritura operadores)
create policy "Bicicletas: lectura autenticada" on public.bicicletas
  for select using (auth.role() = 'authenticated');

create policy "Bicicletas: gestión operadores" on public.bicicletas
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Mantenimientos
create policy "Mantenimientos: lectura operadores" on public.mantenimientos
  for select using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

create policy "Mantenimientos: inserción operadores" on public.mantenimientos
  for insert with check (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Viajes
create policy "Viajes: lectura operadores" on public.viajes
  for select using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

create policy "Viajes: gestión propia ciudadano" on public.viajes
  for all using (
    usuario_id = auth.uid() or
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

create policy "Viajes: ciudadano califica su viaje" on public.viajes
  for update using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Políticas: Waypoints de viaje (mismo dueño que el viaje, o staff)
create policy "Waypoints: lectura dueño del viaje o staff" on public.viaje_waypoints
  for select using (
    exists (
      select 1 from public.viajes v
      where v.id = viaje_id and (
        v.usuario_id = auth.uid()
        or exists (
          select 1 from public.usuarios
          where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
        )
      )
    )
  );

create policy "Waypoints: gestión staff" on public.viaje_waypoints
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Órdenes de traslado
create policy "Traslados: staff gestiona" on public.ordenes_traslado
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

create policy "Traslados: técnico ve las suyas" on public.ordenes_traslado
  for select using (tecnico_id = auth.uid());

-- Políticas: Demanda histórica (solo staff, escritura vía service role)
create policy "Demanda histórica: lectura staff" on public.demanda_historica
  for select using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Suscripciones push (cada usuario gestiona la suya)
create policy "Push: gestión propia" on public.push_subscriptions
  for all using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Políticas: Incidencias
create policy "Incidencias: ciudadano ve las suyas y staff ve todas" on public.incidencias
  for select using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

create policy "Incidencias: ciudadano crea" on public.incidencias
  for insert with check (usuario_id = auth.uid());

create policy "Incidencias: staff actualiza" on public.incidencias
  for update using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Políticas: Alertas (solo operadores/técnicos)
create policy "Alertas: staff gestiona" on public.alertas
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- =========================================
-- Habilitar Realtime
-- =========================================
alter publication supabase_realtime add table public.bicicletas;
alter publication supabase_realtime add table public.estaciones;
alter publication supabase_realtime add table public.incidencias;
alter publication supabase_realtime add table public.alertas;
alter publication supabase_realtime add table public.viajes;
alter publication supabase_realtime add table public.ordenes_traslado;

-- =========================================
-- Datos de Ejemplo (Opcional)
-- =========================================

-- Estaciones de ejemplo en Bogotá
insert into public.estaciones (nombre, direccion, latitud, longitud, capacidad, estado) values
  ('Estación Parque Simón Bolívar', 'Cra 48 # 63-20, Bogotá', 4.6587, -74.0957, 15, 'activa'),
  ('Estación Candelaria', 'Cra 7 # 11-83, Bogotá', 4.5981, -74.0760, 10, 'activa'),
  ('Estación Chapinero', 'Cra 13 # 63-20, Bogotá', 4.6485, -74.0626, 12, 'activa'),
  ('Estación Usaquén', 'Cll 119 # 6-24, Bogotá', 4.6948, -74.0310, 8, 'activa'),
  ('Estación Teusaquillo', 'Cll 34 # 15-12, Bogotá', 4.6415, -74.0728, 10, 'mantenimiento')
on conflict do nothing;
