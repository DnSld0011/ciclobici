-- =========================================
-- CicloBici — Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor (en orden)
-- =========================================

-- 1. Tabla de Usuarios
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  documento text unique not null,
  correo text unique not null,
  celular text unique not null,
  estado text default 'pendiente' check (estado in ('pendiente', 'activo', 'suspendido')),
  rol text default 'ciudadano' check (rol in ('ciudadano', 'operador', 'tecnico')),
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
  duracion_min        integer      default null
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

-- 7. Tabla de Alertas
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

-- Trigger: calcular duracion_min y distancia_km al finalizar viaje
create or replace function public.fn_finalizar_viaje()
returns trigger language plpgsql as $$
begin
  if new.fin_at is not null and old.fin_at is null then
    new.duracion_min := round(extract(epoch from (new.fin_at - new.inicio_at)) / 60)::integer;
    new.distancia_km := round((new.duracion_min::numeric / 60.0) * 12.0, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finalizar_viaje on public.viajes;
create trigger trg_finalizar_viaje
  before update of fin_at on public.viajes
  for each row execute function public.fn_finalizar_viaje();

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
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

-- Políticas: Bicicletas (lectura pública autenticada, escritura operadores)
create policy "Bicicletas: lectura autenticada" on public.bicicletas
  for select using (auth.role() = 'authenticated');

create policy "Bicicletas: gestión operadores" on public.bicicletas
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

-- Políticas: Mantenimientos
create policy "Mantenimientos: lectura operadores" on public.mantenimientos
  for select using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

create policy "Mantenimientos: inserción operadores" on public.mantenimientos
  for insert with check (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

-- Políticas: Viajes
create policy "Viajes: lectura operadores" on public.viajes
  for select using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

create policy "Viajes: gestión propia ciudadano" on public.viajes
  for all using (
    usuario_id = auth.uid() or
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

-- Políticas: Incidencias
create policy "Incidencias: ciudadano ve las suyas y staff ve todas" on public.incidencias
  for select using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

create policy "Incidencias: ciudadano crea" on public.incidencias
  for insert with check (usuario_id = auth.uid());

create policy "Incidencias: staff actualiza" on public.incidencias
  for update using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
    )
  );

-- Políticas: Alertas (solo operadores/técnicos)
create policy "Alertas: staff gestiona" on public.alertas
  for all using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico')
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
