# Gastos de Viaje GBS (`gastos-de-viaje-gbs`)

Plataforma empresarial moderna para la gestión, reporte y comprobación de gastos de viaje y viáticos, desarrollada con **Next.js 15**, **React 18**, **TypeScript**, **Supabase**, **Zod**, **Resend**, **jsPDF** y **PapaParse**.

[![CI/CD Pipeline](https://github.com/gbsolutionalecomp/gastos-de-viaje-gbs/actions/workflows/test.yml/badge.svg)](https://github.com/gbsolutionalecomp/gastos-de-viaje-gbs/actions)
[![Deploy Status](https://img.shields.io/badge/Deploy-Vercel-success)](https://gastos-de-viaje-gbs.vercel.app)

---

## 🚀 Características Principales

- 🔐 **Seguridad Avanzada & Auth**: Middleware SSR de Next.js con `@supabase/ssr`, protección de rutas `/dashboard`, `/reportes`, `/admin` y verificación de roles/tokens en la API (`lib/auth.ts`).
- 🛡️ **Validación de Datos Robusta**: Validación estricta en el servidor y cliente utilizando **Zod** con mensajes explicativos en español.
- 📄 **Exportación PDF Profesional**: Generación instantánea de reportes de viáticos en formato PDF con membrete y desgloses mediante **jsPDF**.
- 📊 **Exportación a CSV**: Descarga instantánea de gastos acumulados a formato CSV utilizando **PapaParse**.
- ✉️ **Notificaciones por Correo**: Plantillas HTML profesionales enviadas a través de **Resend** para notificaciones de aprobación, rechazo y recordatorios.
- 🧪 **Suite de Pruebas Automáticas**: Pruebas unitarias e integración con **Vitest** y **Testing Library**, más pruebas E2E multi-navegador con **Playwright**.
- ⚡ **CI/CD Automatizado**: Integración continua en GitHub Actions para typecheck, linting, tests unitarios, tests E2E y verificación de builds.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **UI & Lógica** | React 18, TypeScript, TailwindCSS |
| **Base de Datos & Auth** | Supabase (Postgres, RLS, Storage) |
| **Validación** | Zod |
| **Correos** | Resend SDK |
| **PDF & CSV** | jsPDF, PapaParse |
| **Testing** | Vitest, Testing Library, Playwright |
| **CI/CD & Hosting** | GitHub Actions, Vercel |

---

## 📁 Estructura del Proyecto

```text
gastos-viaje-main/
├── .github/
│   └── workflows/        # Workflows de CI/CD (test.yml, e2e.yml, deploy.yml)
├── src/
│   ├── app/              # Next.js App Router (Páginas y API routes)
│   │   ├── api/          # Endpoints de la API (/api/gastos, /api/reportes, /api/correos)
│   │   └── layout.tsx
│   ├── components/       # Componentes React (GastoForm, ReporteList, LoginForm)
│   ├── features/         # Módulos por dominio (gastos, reportes, usuarios)
│   ├── hooks/            # Custom hooks (useAuth, useRequireAuth, useGastos)
│   ├── lib/              # Utilidades centrales (auth, api, pdf, csv, email, schemas, store)
│   ├── types/            # Tipos de TypeScript centralizados (index.ts)
│   └── middleware.ts     # Middleware de autenticación y redirecciones
├── tests/
│   ├── api/              # Tests unitarios de endpoints de API
│   ├── components/       # Tests unitarios de componentes React
│   ├── e2e/              # Tests E2E con Playwright (auth.spec.ts, gastos.spec.ts)
│   ├── hooks/            # Tests unitarios de custom hooks
│   └── lib/              # Tests unitarios de exportadores (PDF, CSV, email)
├── next.config.js        # Configuración de Next.js (Security headers, CORS, Sharp)
├── vitest.config.ts      # Configuración del ejecutor de tests Vitest
├── playwright.config.ts  # Configuración de Playwright E2E
├── .env.example          # Guía detallada de variables de entorno
└── README.md
```

---

## ⚙️ Configuración e Instalación

### 1. Requisitos Previos
- Node.js >= 20.x
- npm / pnpm / yarn

### 2. Clonar e Instalar Dependencias
```bash
git clone https://github.com/gbsolutionalecomp/gastos-de-viaje-gbs.git
cd gastos-de-viaje-gbs
npm install
```

### 3. Configurar Variables de Entorno
Copia `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
Edita `.env.local` y asigna las credenciales de Supabase y Resend.

---

## 🧪 Ejecución de Scripts

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local en `http://localhost:3000` |
| `npm run build` | Compila la aplicación para producción |
| `npm run start` | Arranca el servidor compilado de producción |
| `npm run typecheck` | Ejecuta la comprobación estricta de tipos de TypeScript |
| `npm run lint` | Valida las reglas de ESLint |
| `npm run test` | Ejecuta la suite de pruebas unitarias e integración con Vitest |
| `npm run test:watch` | Modo observador interactivo de Vitest |
| `npm run test:e2e` | Ejecuta la suite de pruebas E2E con Playwright |

---

## 📚 Documentación Adicional

- 🛠️ [Guía de Desarrollo (DEVELOPMENT.md)](file:///c:/Users/Clauder%20Castillo/Downloads/MAPEO%20DE%20PROCESOS%20GBS%20SOLUTIONS/gastos-viaje-main/DEVELOPMENT.md)
- 🔌 [Especificación de API (API.md)](file:///c:/Users/Clauder%20Castillo/Downloads/MAPEO%20DE%20PROCESOS%20GBS%20SOLUTIONS/gastos-viaje-main/API.md)
- 🧪 [Estrategia de Pruebas (TESTING.md)](file:///c:/Users/Clauder%20Castillo/Downloads/MAPEO%20DE%20PROCESOS%20GBS%20SOLUTIONS/gastos-viaje-main/TESTING.md)
- 🚀 [Guía de Despliegue (DEPLOYMENT.md)](file:///c:/Users/Clauder%20Castillo/Downloads/MAPEO%20DE%20PROCESOS%20GBS%20SOLUTIONS/gastos-viaje-main/DEPLOYMENT.md)
- 🤝 [Guía de Contribución (CONTRIBUTING.md)](file:///c:/Users/Clauder%20Castillo/Downloads/MAPEO%20DE%20PROCESOS%20GBS%20SOLUTIONS/gastos-viaje-main/CONTRIBUTING.md)

---

## 📄 Licencia & Propiedad

Desarrollado para **GBS Solutions**. Todos los derechos reservados.
