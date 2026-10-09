# Commits propuestos para Codex — modo oscuro

Estos commits están preparados para dejar evidencia clara en GitHub.

## Commit 1 — corrección visual definitiva

```bash
git add -- "aplicacion/paginas HTML/crear_usuario.html" \
           "aplicacion/paginas HTML/estadisticas.html" \
           "aplicacion/recursos/estilos CCS/tema_oscuro_modulos_20261008.css"

git commit -m "fix(theme): aplicar modo oscuro completo en usuarios y estadisticas"
```

Incluye el refuerzo final de cascada que evita paneles blancos en modo oscuro.

## Commit 2 — prueba de regresión

```bash
git add -- "pruebas/prueba_tema_usuarios_estadisticas.js"

git commit -m "test(ui): cubrir cascada final del tema oscuro"
```

Comprueba que Crear usuario y Estadísticas cargan la nueva hoja final y que existen las reglas críticas de cobertura.

## Commit 3 — evidencia de validación

```bash
git add -- "documentacion/VALIDACION_TEMA_OSCURO_2026-10-08_v3.md" \
           "documentacion/COMMITS_TEMA_OSCURO_2026-10-08_v3.md"

git commit -m "docs(ui): registrar correccion definitiva del modo oscuro"
```

## Nota sobre la imagen del menú izquierdo

La imagen `aplicacion/recursos/imagenes/sidebar_campus_20261008.png` ya forma parte del cambio anterior y se conserva. `navegacion_aprendiz.css` sigue utilizándola como fondo local de la barra lateral. No se propone un commit duplicado para esa imagen en esta corrección.
