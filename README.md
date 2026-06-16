# BuildingFex — Frontend (Vue 3)

Aplicación web de BuildingFex. Consume la API real **BuildingFex.Api** (.NET + MySQL), no json-server.

## Requisitos

- Node.js 18+ y npm
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- MySQL 8 (local o Docker)

## Inicio rápido (frontend + backend)

### 1. Backend

```bash
cd C:\Users\smbmontalvo\Documents\BackEnd
docker compose up -d          # MySQL, si usas Docker
cd BuildingFex.Api
dotnet restore
dotnet run
```

API: `http://localhost:5001` — Swagger: `http://localhost:5001/swagger`

### 2. Frontend

```bash
cd C:\Users\smbmontalvo\Downloads\Fronted
npm install
cp .env.example .env.development   # o copia manual en Windows
npm run dev
```

App: `http://localhost:5173`

En desarrollo, las peticiones van al mismo origen (`localhost:5173`) y **Vite las reenvía** al backend en `:5001` (ver `vite.config.js`).

### 3. Probar login

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | `admin@buildingfex.test` | `admin123` |
| Residente | `giuseppevillanueva15@gmail.com` | `naruto15` |

## Variables de entorno

| Variable | Desarrollo | Producción |
|----------|------------|------------|
| `VITE_API_BASE_URL` | Vacío (usa proxy Vite) | URL pública de BuildingFex.Api |
| `VITE_API_PROXY_TARGET` | `http://localhost:5001` (opcional) | — |

Copia `.env.example` → `.env.development` y ajusta `.env.production` antes de `npm run build`.

## Arquitectura API

- `src/shared/infrastructure/api/apiClient.js` — axios + JWT (`Authorization: Bearer`)
- `src/iam/infrastructure/authApi.js` — `POST /api/v1/authentication/sign-in` y `register-admin`
- Módulos `*Api.js` por bounded context — rutas compat (`/users`, `/incidents`, `/receipts`, …)

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite dev server (proxy → API :5001) |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve `dist/` localmente |
| `npm run mock:server` | json-server legacy (solo referencia, no usar en flujo normal) |

## Producción

1. Despliega **BuildingFex.Api** y anota su URL.
2. En `.env.production`: `VITE_API_BASE_URL=https://tu-api.example.com`
3. `npm run build` y publica `dist/`.

## Licencia

Privado — BuildingFex.
