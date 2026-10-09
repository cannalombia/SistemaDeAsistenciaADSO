# Commits sugeridos — corrección final de modo oscuro

## Commit 1 — corrección visual real

```bash
git add -- "aplicacion/paginas HTML/crear_usuario.html" \
           "aplicacion/paginas HTML/estadisticas.html" \
           "aplicacion/recursos/estilos CCS/base.css"

git commit -m "fix(theme): corregir modo oscuro completo de crear usuario"
```

Incluye:

- paneles blancos convertidos a superficies oscuras;
- contraste correcto de títulos, textos y etiquetas;
- inputs y selects oscuros;
- fecha/hora de actualización integrada al tema;
- campana, badge y diálogo de notificaciones integrados al tema;
- nuevo cache-buster de la hoja de refuerzo compartida.

## Commit 2 — prueba de regresión

```bash
git add -- "pruebas/prueba_tema_usuarios_estadisticas.js"

git commit -m "test(ui): validar tema oscuro fecha y notificaciones"
```

## Commit 3 — evidencia

```bash
git add -- "documentacion/VALIDACION_TEMA_OSCURO_FINAL_2026-10-08.md" \
           "documentacion/COMMITS_TEMA_OSCURO_FINAL_2026-10-08.md"

git commit -m "docs(ui): documentar correccion final del modo oscuro"
```

## Antes del push

En el equipo del proyecto:

```bash
npm ci
npm test
git status
git push
```
