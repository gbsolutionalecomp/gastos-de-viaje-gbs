# Gastos de Viaje — SECOVI

Prototipo independiente para gastos, tarjetas corporativas, cortes, transacciones, CFDI y exportación contable interna.

## Alcance decidido

- Cada tarjeta (por ejemplo, `AMEX Alejandro`) tiene sesiones o cortes propios.
- Las transacciones se importan hoy mediante CSV a la sesión seleccionada.
- Cuando Clara no entrega el XML, el CFDI se adjunta a la transacción y se valida su UUID y RFC.
- Un corte sólo se concilia cuando la suma de transacciones coincide con el estado de cuenta.
- El TXT agrupa muchas facturas en un lote y conserva detalle por CFDI.
- No se envían datos ni pólizas a Microsip.
- La API de Clara no está activa. Debe permanecer con `CLARA_SYNC_ENABLED=false` hasta terminar seguridad y piloto.

## Desarrollo

```bash
npm install
npm run dev
```

La información del módulo nuevo se conserva en `localStorage` durante el prototipo. Antes de usar datos reales deben aplicarse Supabase Auth, la migración `005_tarjetas_seguridad.sql` y las pruebas de `SECURITY.md`.
