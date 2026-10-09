# EVIDENCIA DE CAMBIOS UI — 08/10/2026 — V2

## Objetivo de esta corrección

Se corrigieron exclusivamente los puntos solicitados después de revisar las capturas reales del sistema:

1. Los tres indicadores funcionales de `estadisticas.html` ahora respetan el mismo sistema visual de las tarjetas superiores de `crear_usuario.html`.
2. El modo oscuro de `crear_usuario.html` cubre toda la pantalla y no deja paneles blancos.
3. Se conserva la imagen del campus en la barra lateral izquierda para todos los módulos que usan la navegación principal.
4. Se agregó una prueba automática para impedir regresiones de estos tres puntos.

## Cambio 1 — Indicadores de Estadísticas

Indicadores conservados, sin cambiar su información ni su lógica:

- Aprendices con registros.
- Fichas con registros.
- Porcentaje de presentes.

Se modificó únicamente su presentación para igualar las tarjetas de Crear usuario:

- superficie neumórfica gris clara;
- radio de 20 px;
- sombra exterior e interior;
- iconos circulares con acentos verde, azul y violeta;
- jerarquía tipográfica equivalente;
- franja inferior integrada;
- hover equivalente;
- versión equivalente para modo oscuro;
- responsive en móvil.

Archivos:

- `aplicacion/paginas HTML/estadisticas.html`
- `aplicacion/recursos/estilos CCS/estadisticas_reportes.css`

### Commit sugerido

```bash
git add -- "aplicacion/paginas HTML/estadisticas.html" "aplicacion/recursos/estilos CCS/estadisticas_reportes.css"
git commit -m "fix(ui): igualar indicadores de estadisticas al diseno de usuarios"
```

## Cambio 2 — Modo oscuro completo de Crear usuario

La clase `dark-mode` ya existía, pero los paneles internos tenían estilos claros que la sobrescribían. Se añadió cobertura específica para:

- fondo principal;
- encabezado;
- tarjetas superiores;
- pestañas CSV/SQL;
- panel de importación;
- selector de archivo;
- resultados de importación;
- directorio de usuarios;
- buscador;
- encabezado y filas de la tabla;
- badges de rol y estado;
- botones de acciones;
- formulario de creación;
- inputs y selects;
- botón para mostrar contraseña;
- mensajes y textos auxiliares.

También se aplica el tema guardado al inicio de la página para evitar que la pantalla aparezca blanca antes de que cargue el JavaScript general.

Archivos:

- `aplicacion/paginas HTML/crear_usuario.html`
- `aplicacion/recursos/estilos CCS/estadisticas_usuarios.css`

### Commit sugerido

```bash
git add -- "aplicacion/paginas HTML/crear_usuario.html" "aplicacion/recursos/estilos CCS/estadisticas_usuarios.css"
git commit -m "fix(theme): completar modo oscuro de gestion de usuarios"
```

## Cambio 3 — Prueba de regresión visual

Se creó `pruebas/prueba_tema_usuarios_estadisticas.js` y se añadió a `npm test`.

Comprueba automáticamente:

- que Crear usuario restaure el tema almacenado;
- que existan las reglas oscuras de los paneles principales;
- que Estadísticas conserve exactamente tres indicadores funcionales;
- que los acentos sean verde, azul y violeta;
- que los indicadores utilicen la estructura y superficie del diseño de Crear usuario;
- que exista paridad en modo oscuro;
- que la barra lateral siga enlazando `sidebar_campus_20261008.png`;
- que el archivo de imagen exista físicamente dentro del proyecto.

Archivos:

- `pruebas/prueba_tema_usuarios_estadisticas.js`
- `package.json`

### Commit sugerido

```bash
git add -- "pruebas/prueba_tema_usuarios_estadisticas.js" package.json
git commit -m "test(ui): validar tarjetas tema oscuro y fondo lateral"
```

## Imagen situada en la barra lateral izquierda

El recurso utilizado sigue siendo:

`aplicacion/recursos/imagenes/sidebar_campus_20261008.png`

La regla que lo coloca en el lateral está en:

`aplicacion/recursos/estilos CCS/navegacion_aprendiz.css`

Configuración relevante:

```css
.sidebar {
    background:
        linear-gradient(180deg, rgba(0,59,92,.94) 0%, rgba(0,43,67,.82) 50%, rgba(0,31,49,.60) 100%),
        url("sidebar_campus_20261008.png") center bottom / cover no-repeat,
        #003b5c;
}
```

El degradado azul institucional se coloca por encima de la fotografía para mantener legibilidad de los módulos.

## Validación ejecutada

- `node --check` sobre JavaScript del proyecto: OK.
- `node pruebas/prueba_tema_usuarios_estadisticas.js`: OK.
- `node pruebas/prueba_sidebar_visual.js`: OK.
- `node pruebas/prueba_estadisticas_frontend.js`: OK.
- `node pruebas/prueba_estadisticas_analitica.js`: OK.
- `npm test` completo en harness aislado de dependencias externas: EXIT 0.
- Prueba de escala: 300 usuarios, 240 aprendices, 8 fichas operativas con QR, 11 instructores y 40 franjas: OK.

## Nota para Codex

No crear un commit nuevo para la imagen lateral si Git no muestra cambios en `sidebar_campus_20261008.png` o `navegacion_aprendiz.css`: ese recurso ya venía de la modificación anterior. En esta ronda se valida y conserva; no se simula un cambio inexistente.
