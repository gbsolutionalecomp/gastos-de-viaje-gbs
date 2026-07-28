# Seguridad y salida a producción

La aplicación usa Supabase Auth y RLS multiempresa. Antes de conectar datos reales,
aplica y valida en orden `005_tarjetas_seguridad.sql` y
`006_compatibilidad_produccion.sql` en un entorno de prueba.

En producción no se permite autenticar mediante perfiles guardados en
`localStorage`, ni asignar automáticamente el rol Administrador a un correo sin
perfil. El acceso directo sólo existe para desarrollo local o una demo aislada.

La aplicación no consulta tablas protegidas hasta que Supabase confirma una sesión
válida. Mantén `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor y nunca
la expongas con el prefijo `NEXT_PUBLIC_`.

## Controles obligatorios

- `SUPABASE_SERVICE_ROLE_KEY` sólo existe en Vercel/server; nunca usa prefijo `NEXT_PUBLIC_`.
- RLS activo en todas las tablas públicas y aislamiento por `empresa_id`.
- El rol se toma de `usuarios`, ligado a `auth.users`; no de metadatos editables ni del navegador.
- El bucket de CFDI es privado. La primera carpeta siempre es `empresa_id`; los enlaces firmados duran una hora.
- UUID y hash de CFDI son únicos por empresa. Los IDs/hash de Clara hacen la sincronización idempotente.
- La API Clara permanece deshabilitada con `CLARA_SYNC_ENABLED=false` hasta aprobar el piloto.
- No existe integración, escritura ni marcado de registros en Microsip.
- Antes de producción: MFA para administradores, rotación de secretos, revisión de usuarios, respaldo/restauración, pruebas RLS entre dos empresas, auditoría de dependencias y bitácora de eventos.
- La importación/exportación Excel heredada fue retirada; CSV, XML y TXT cubren los flujos admitidos sin depender de `xlsx`.

## Verificación mínima

1. Un empleado de empresa A no puede leer ni modificar filas o archivos de empresa B.
2. Un usuario sin rol contable no puede cerrar cortes ni generar lotes.
3. Repetir un webhook/importación de Clara no duplica transacciones.
4. Repetir un XML no duplica UUID ni hash.
5. Un corte no cierra si el total importado difiere del estado de cuenta.
6. Un TXT no se descarga si Debe y Haber no cuadran.
