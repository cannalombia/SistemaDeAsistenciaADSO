# Commits sugeridos para Codex / GitHub

## Commit 1 — identificar la versión activa del servidor

```bash
git add BUILD_ID.txt servidor/servidor.js
git commit -m "fix(server): identificar build activo en health check"
```

## Commit 2 — evitar que localhost use otra copia del proyecto

```bash
git add ABRIR_PROYECTO.cmd herramientas/automatizacion/asegurar_servidor.ps1
git commit -m "fix(startup): reiniciar Blue Magic cuando localhost usa otra version"
```

## Commit 3 — pruebas y evidencia del modo oscuro

```bash
git add pruebas/prueba_tema_usuarios_estadisticas.js documentacion/VALIDACION_INSTANCIA_TEMA_2026-10-08.md documentacion/COMMITS_INSTANCIA_TEMA_2026-10-08.md documentacion/evidencias/tema_oscuro_crear_usuario_verificado.png
git commit -m "test(ui): validar tema oscuro y servidor de la version actual"
```

No crear un commit adicional de CSS si ya se incluyeron los cambios de tema oscuro de Crear usuario en los commits anteriores; esta entrega corrige específicamente la causa que hacía que el navegador siguiera sirviendo una copia vieja.
