-- ============================================================
-- San Borja en Bici — migración: encuesta de usabilidad (SUS + NPS)
-- Cópialo y ejecútalo en Supabase Dashboard → SQL Editor → Run
-- Es seguro volver a correrlo (usa IF NOT EXISTS / DROP...CREATE).
-- ============================================================

create table if not exists public.encuestas_usabilidad (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.usuarios(id) on delete set null,
  rol         text not null,
  p1          smallint not null check (p1 between 1 and 5),
  p2          smallint not null check (p2 between 1 and 5),
  p3          smallint not null check (p3 between 1 and 5),
  p4          smallint not null check (p4 between 1 and 5),
  p5          smallint not null check (p5 between 1 and 5),
  p6          smallint not null check (p6 between 1 and 5),
  p7          smallint not null check (p7 between 1 and 5),
  p8          smallint not null check (p8 between 1 and 5),
  p9          smallint not null check (p9 between 1 and 5),
  p10         smallint not null check (p10 between 1 and 5),
  nps         smallint not null check (nps between 0 and 10),
  comentario  text,
  created_at  timestamptz not null default now()
);

alter table public.encuestas_usabilidad enable row level security;

-- Cualquier usuario autenticado responde la encuesta una vez (su propia fila).
drop policy if exists "Encuesta usabilidad: usuario crea la suya" on public.encuestas_usabilidad;
create policy "Encuesta usabilidad: usuario crea la suya"
  on public.encuestas_usabilidad for insert
  with check (usuario_id = auth.uid());

-- El propio usuario puede ver su respuesta (para saber si ya la respondió).
drop policy if exists "Encuesta usabilidad: usuario ve la suya" on public.encuestas_usabilidad;
create policy "Encuesta usabilidad: usuario ve la suya"
  on public.encuestas_usabilidad for select
  using (usuario_id = auth.uid());

-- Staff ve todas las respuestas para calcular el SUS/NPS real.
drop policy if exists "Encuesta usabilidad: staff lee todas" on public.encuestas_usabilidad;
create policy "Encuesta usabilidad: staff lee todas"
  on public.encuestas_usabilidad for select
  using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('operador', 'tecnico', 'administrador')
    )
  );

-- Un usuario no debería poder responder la encuesta más de una vez.
create unique index if not exists encuestas_usabilidad_usuario_unico
  on public.encuestas_usabilidad(usuario_id)
  where usuario_id is not null;
