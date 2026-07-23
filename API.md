# Documentación de API (`API.md`)

Todos los endpoints de la API se encuentran en `/api/` y retornan JSON con una estructura estandarizada:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa",
  "timestamp": "2026-07-23T22:00:00.000Z"
}
```

En caso de error:

```json
{
  "success": false,
  "error": "Mensaje detallado del error",
  "timestamp": "2026-07-23T22:00:00.000Z"
}
```

---

## Endpoints

### 1. `GET /api/gastos`
- **Descripción**: Obtiene la lista de gastos registrados.
- **Autenticación**: Requerida (Bearer Token o Cookie Session).
- **Parámetros Query**: `usuarioId` (opcional).
- **Cache**: 5 minutos (`Cache-Control: public, max-age=300`).

### 2. `POST /api/gastos`
- **Descripción**: Registra un nuevo gasto.
- **Autenticación**: Requerida.
- **Body**: Objeto `Gasto` validado con `GastoSchema` (Zod).

### 3. `PUT /api/gastos/[id]`
- **Descripción**: Actualiza un gasto existente.
- **Autenticación**: Requerida.

### 4. `DELETE /api/gastos/[id]`
- **Descripción**: Elimina un gasto.
- **Autenticación**: Requerida.

### 5. `GET /api/reportes`
- **Descripción**: Obtiene la lista de reportes de viáticos.
- **Autenticación**: Requerida.
- **Cache**: 10 minutos (`Cache-Control: public, max-age=600`).

### 6. `POST /api/reportes`
- **Descripción**: Crea un nuevo reporte de viáticos.
- **Autenticación**: Requerida.
