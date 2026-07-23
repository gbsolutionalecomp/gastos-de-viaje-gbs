# Guía de Despliegue (`DEPLOYMENT.md`)

## Despliegue en Vercel

1. **Vincular el Repositorio de GitHub**:
   - URL Repositorio: `https://github.com/gbsolutionalecomp/gastos-de-viaje-gbs`
   - URL Producción: `https://gastos-de-viaje-gbs.vercel.app`

2. **Configuración de Variables de Entorno en Vercel**:
   Ingresa a Vercel → Project Settings → Environment Variables y añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `CORREO_REMITENTE`
   - `NEXT_PUBLIC_APP_URL`

3. **Verificación de Despliegues Automáticos**:
   Cada push a la rama `main` dispara automáticamente las GitHub Actions (`test.yml`, `e2e.yml`) y se realiza el despliegue automático en Vercel.
