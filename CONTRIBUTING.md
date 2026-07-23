# Guía de Contribución (`CONTRIBUTING.md`)

¡Gracias por contribuir a **Gastos de Viaje GBS**!

## Flujo de Trabajo

1. Abre un Issue o elige uno existente.
2. Crea una rama descriptiva: `feature/mi-nueva-funcionalidad` o `fix/corregir-bug`.
3. Asegúrate de cumplir las verificaciones locales antes de enviar un Pull Request:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```
4. Todo Pull Request requiere aprobación de al menos 1 revisor y el paso exitoso del pipeline de CI/CD en GitHub Actions.
