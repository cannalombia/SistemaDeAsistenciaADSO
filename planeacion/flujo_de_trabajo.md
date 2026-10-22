# Flujo de trabajo GitHub

1. Confirmar que no existe un issue duplicado y redactar una unidad de trabajo pequena.
2. Para funcionalidad, usar historia `Como / quiero / para` y tres criterios `Dado / cuando / entonces`; para defecto, incluir reproduccion, esperado, actual y evidencia sanitizada.
3. Etiquetar, asignar al responsable y agregar al proyecto. El estado inicial es `Todo`.
4. Mover una sola tarea a `In Progress` cuando comienza el trabajo.
5. Implementar sin incluir secretos ni datos reales. Revisar `.gitignore`, `git status`, el diff y el area de stage.
6. Ejecutar pruebas proporcionales: verificador de planeacion, suite automatizada, HTTP, roles, QR, manual, MySQL y biometria se validan por separado.
7. Crear un commit actual y honesto: `feat(...): ... (closes #N)` o `fix(...): ... (fixes #N)`. No usar fechas artificiales ni commits vacios.
8. Publicar por la ruta permitida. Si `main` esta protegida, abrir PR y colocar la palabra de cierre en el PR.
9. Confirmar en GitHub el cierre y el cambio a `Done`. Si una prueba fisica falta, mantener abierto el issue y registrar la limitacion.
10. Actualizar backlog, historial, incidencias y entrega con URLs y hashes reales.

## Comprobaciones de privacidad antes de publicar

```powershell
git status -sb
git diff --cached --check
git diff --cached --name-only
git grep -n -I -E "(PASSWORD|TOKEN|SECRET|BIOMETRIC.*KEY)=" -- ':!*.example'
```

Revisar tambien `.env`, `*.bio.json`, `*.key`, CSV de operacion, JSON de aprendices/asistencia, SQL con datos, respaldos y capturas con informacion personal.
