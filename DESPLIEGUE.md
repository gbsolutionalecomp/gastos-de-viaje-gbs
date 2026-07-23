# 🚀 Guía de Despliegue — Gastos de Viaje
## De artefacto de Claude a aplicación web real

---

## ¿Qué vamos a usar y por qué?

| Servicio | Para qué | Costo |
|----------|----------|-------|
| **Supabase** | Base de datos, login, archivos | Gratis / $25 USD/mes si escalan |
| **Vercel** | Hosting de la app | Gratis |
| **Resend** | Correos automáticos | Gratis hasta 3,000/mes |
| **Cloudflare** | Dominio personalizado | ~$15 USD/año |

**Total: $0 para empezar, máximo ~$40 USD/mes si escalan**

---

## PASO 1 — Crear el proyecto en Supabase (20 min)

1. Ir a [supabase.com](https://supabase.com) → **Start your project**
2. Crear cuenta con GitHub o Google
3. **New project** → Nombre: `gastos-viaje` → Región: `South America (São Paulo)` → Contraseña segura → **Create project**
4. Esperar ~2 minutos a que se inicialice
5. Ir a **SQL Editor** → pegar el contenido de `supabase/migrations/001_schema_inicial.sql` → **Run**
6. Ir a **Storage** → crear 3 buckets:
   - `logos-empresas` (público)
   - `archivos-expedientes` (privado)
   - `reportes-pdf` (privado)

### Configurar login con Google:
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear proyecto → APIs & Services → Credentials → OAuth 2.0 Client IDs
3. Tipo: Web Application
4. Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
5. Copiar Client ID y Client Secret
6. En Supabase → Authentication → Providers → Google → pegar credenciales → Enable

### Configurar login con Microsoft:
1. Ir a [portal.azure.com](https://portal.azure.com)
2. Azure Active Directory → App registrations → New registration
3. Redirect URI: `https://xxxx.supabase.co/auth/v1/callback`
4. Certificates & secrets → New client secret
5. En Supabase → Authentication → Providers → Azure → pegar credenciales → Enable

---

## PASO 2 — Configurar Resend para correos (10 min)

1. Ir a [resend.com](https://resend.com) → crear cuenta gratis
2. **Domains** → Add domain → ingresar tu dominio (ej: `tuempresa.com`)
3. Agregar los registros DNS que te indica (en Cloudflare o donde tengas el dominio)
4. **API Keys** → Create API Key → copiar la clave
5. Guardar la clave como `RESEND_API_KEY` en las variables de entorno

---

## PASO 3 — Desplegar en Vercel (15 min)

1. Ir a [vercel.com](https://vercel.com) → crear cuenta con GitHub
2. **New Project** → importar el repositorio de GitHub donde subiste el código
3. Framework: **Next.js** (lo detecta automáticamente)
4. En **Environment Variables** agregar todas las variables del archivo `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `CORREO_REMITENTE`
   - `NEXT_PUBLIC_APP_URL` (poner la URL de Vercel primero, luego el dominio propio)
5. **Deploy** → esperar ~3 minutos
6. Vercel te da una URL tipo `gastos-viaje-xxx.vercel.app`

---

## PASO 4 — Dominio propio (opcional, 15 min)

1. Comprar dominio en [Cloudflare Registrar](https://cloudflare.com) (~$15/año)
   - Sugerencia: `viaticos.tuempresa.com` o `gastos.tuempresa.com`
2. En Vercel → tu proyecto → Settings → Domains → Add domain
3. Seguir las instrucciones para apuntar el DNS
4. Actualizar `NEXT_PUBLIC_APP_URL` en Vercel con el dominio real

---

## PASO 5 — Migrar datos del artefacto (30 min)

Los datos actuales están en el almacenamiento del artefacto de Claude.
Para migrarlos:

1. En la app actual (artefacto), abrir DevTools → Application → Storage
2. Buscar las claves: `gv-solicitudes`, `gv-empresas`, `gv-usuarios`, `gv-tickets`
3. Copiar cada JSON
4. En Supabase → Table Editor → insertar los datos en las tablas correspondientes
   (o pedirle a Claude que genere el script de migración con los datos)

---

## PASO 6 — Primera vez en la app desplegada

1. Abrir la URL de Vercel
2. Hacer login con Google o Microsoft
3. El sistema detecta que es el primer usuario → lo crea como **Administrador**
4. Ir a **Configuración** → crear la empresa → dar de alta usuarios
5. Los demás usuarios entran con su correo corporativo de Google/Microsoft

---

## Estructura de costos mensual estimada

| Usuarios activos | Supabase | Vercel | Resend | Total |
|-----------------|----------|--------|--------|-------|
| 1–10 | Gratis | Gratis | Gratis | **$0** |
| 10–50 | Gratis | Gratis | Gratis | **$0** |
| 50–200 | $25/mes | Gratis | Gratis | **$25** |
| 200+ | $25/mes | $20/mes | $20/mes | **$65** |

---

## Integración con API de Clara (cuando estén listos)

1. Escribir a `contacto@clara.com` pidiendo acceso API y credenciales MTLS
2. Con las credenciales, agregar `CLARA_CLIENT_ID`, `CLARA_CLIENT_SECRET` y el certificado
3. Desarrollar y probar el endpoint de sincronización: actualmente no existe y no debe simularse como terminado
4. Mantener `CLARA_SYNC_ENABLED=false` hasta aprobar seguridad, idempotencia y un piloto por tarjeta. Después, la sincronización puede ser:
   - **Manual**: botón en la app que descarga los movimientos del día
   - **Automática**: Supabase Edge Function que corre cada hora

---

## Soporte

Cualquier duda del despliegue, compartirle este documento a quien lo configure
o pedirle a Claude que resuelva problemas específicos con el código.
