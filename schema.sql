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
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  tipo text not null,
  marca text,
  modelo text,
  qr_url text,
  estado text default 'disponible' check (estado in ('disponible', 'en_viaje', 'mantenimiento', 'baja')),
  estacion_id uuid references public.estaciones(id) on delete set null,
  created_at timestamptz default now()
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
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  bicicleta_id uuid references public.bicicletas(id) on delete set null,
  estacion_origen_id uuid references public.estaciones(id) on delete set null,
  estacion_destino_id uuid references public.estaciones(id) on delete set null,
  inicio_at timestamptz default now(),
  fin_at timestamptz,
  estado text default 'activo' check (estado in ('activo', 'finalizado', 'cancelado'))
);

-- =========================================
-- Row Level Security (RLS)
-- =========================================

alter table public.usuarios enable row level security;
alter table public.estaciones enable row level security;
alter table public.bicicletas enable row level security;
alter table public.mantenimientos enable row level security;
alter table public.viajes enable row level security;

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

-- =========================================
-- Habilitar Realtime
-- =========================================
-- Ejecutar esto en el Dashboard de Supabase > Database > Replication
-- o mediante este SQL:
alter publication supabase_realtime add table public.bicicletas;
alter publication supabase_realtime add table public.estaciones;

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
