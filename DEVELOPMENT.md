# Guía de Desarrollo (`DEVELOPMENT.md`)

## Entorno Local

1. **Configuración de Variables de Entorno**:
   Asegúrate de contar con un archivo `.env.local` creado a partir de `.env.example`.

2. **Convenciones de Código**:
   - Todo el código nuevo debe estar en TypeScript estricto.
   - Las validaciones de payload deben realizarse utilizando schemas de `Zod` guardados en `src/lib/schemas/`.
   - Las respuestas HTTP en API routes deben formatearse mediante `apiSuccess` o `apiError` importados de `src/lib/api-response.ts`.
   - Todo endpoint en `/api/` debe incluir `const auth = await checkAuth(req)` como primera instrucción.

3. **Estructura de Componentes**:
   - Componentes UI puros y reutilizables van en `src/components/`.
   - Lógica de dominio extensa se organiza dentro de `src/features/`.
