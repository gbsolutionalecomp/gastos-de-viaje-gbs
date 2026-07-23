# Estrategia y Ejecución de Pruebas (`TESTING.md`)

El proyecto cuenta con dos suites completas de pruebas automáticas:

## 1. Pruebas Unitarias e Integración (Vitest)

Ejecutadas con el motor súper rápido **Vitest** en un ambiente `jsdom`.

### Ejecutar Pruebas
```bash
npm run test
```

### Ejecutar Pruebas en Modo Observador (Watch)
```bash
npm run test:watch
```

---

## 2. Pruebas End-to-End (Playwright)

Pruebas en navegadores reales (Chromium, Firefox, WebKit) para simular el comportamiento exacto del usuario.

### Ejecutar Pruebas E2E
```bash
npm run test:e2e
```
