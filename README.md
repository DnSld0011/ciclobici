# 🚲 CicloBici — Sistema Municipal de Bicicletas Compartidas

Aplicación web completa para gestión de bicicletas compartidas, construida con Next.js 14, Supabase y Vercel.

## Stack Técnico

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript estricto
- **Estilos**: Tailwind CSS + componentes Radix UI
- **Base de datos**: Supabase (PostgreSQL + Realtime)
- **Autenticación**: Supabase Auth (OTP por celular)
- **Mapas**: Leaflet + React-Leaflet
- **Gráficos**: Recharts
- **QR**: librería `qrcode`
- **Deploy**: Vercel

## Funcionalidades

| Rol | Funcionalidades |
|-----|----------------|
| **Ciudadano** | Registro, verificación celular OTP, mapa en tiempo real, disponibilidad de estaciones |
| **Operador** | CRUD estaciones, gestión bicicletas con código y QR automático, mantenimientos, predicción de demanda, mapa realtime |
| **Técnico** | Registro de mantenimientos, historial por bicicleta |

## Instalación Local

### 1. Clonar y preparar

```bash
git clone https://github.com/tu-usuario/ciclobici.git
cd ciclobici
npm install
cp .env.example .env.local
```

### 2. Configurar variables de entorno

Editar `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 3. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** → ejecutar el contenido de `schema.sql`
3. Ir a **Database > Replication** → activar tablas `bicicletas` y `estaciones` para Realtime
4. Ir a **Authentication > Providers > Phone** → configurar SMS (Twilio o Vonage)

### 4. Ejecutar

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Deploy en Vercel

1. Subir el proyecto a GitHub
2. Ir a [vercel.com](https://vercel.com) → Import Project → seleccionar el repositorio
3. Agregar variables de entorno en Vercel Dashboard > Settings > Environment Variables:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo backend) |

4. Click en **Deploy** — cada push a `main` despliega automáticamente

## Crear Usuario Operador

Después de que el usuario se registre, ejecutar en Supabase SQL Editor:

```sql
UPDATE public.usuarios
SET rol = 'operador', estado = 'activo'
WHERE correo = 'operador@ejemplo.com';
```

## Estructura del Proyecto

```
ciclobici/
├── app/
│   ├── (auth)/           # Login, registro, verificación OTP
│   ├── (ciudadano)/      # Mapa para ciudadanos
│   ├── (operador)/       # Panel completo para operadores
│   ├── (tecnico)/        # Panel técnico de mantenimiento
│   └── api/prediccion/   # Endpoint predicción de demanda
├── components/
│   ├── ui/               # Button, Input, Card, Dialog, etc.
│   └── maps/             # Componente mapa Leaflet
├── lib/supabase/         # Clientes Supabase
├── lib/utils/            # Validaciones y utilidades
├── types/                # Tipos TypeScript
├── schema.sql            # SQL completo para Supabase
└── middleware.ts         # Protección de rutas por rol
```
