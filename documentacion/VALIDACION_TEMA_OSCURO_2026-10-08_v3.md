# Validación — corrección definitiva de modo oscuro

Fecha: 2026-10-08

## Problema reproducido por capturas

El `body` sí recibía la clase `dark-mode`, pero varias superficies internas de **Crear usuario** seguían usando fondos claros: importación CSV/SQL, directorio, filas de tabla y formulario. El mismo riesgo existía en paneles de **Estadísticas**.

## Corrección aplicada

Se creó `aplicacion/recursos/estilos CCS/tema_oscuro_modulos_20261008.css` y se carga como última hoja de estilo en:

- `crear_usuario.html`
- `estadisticas.html`

La hoja usa selectores específicos de `body.dark-mode` y prioridades explícitas en las propiedades visuales necesarias para impedir que reglas claras heredadas vuelvan a sobrescribir el tema.

### Crear usuario

Cobertura verificada por código para:

- fondo general y contenido principal;
- tarjetas de usuarios/instructores/aprendices;
- pestañas CSV/SQL;
- panel de importación;
- selector de archivos;
- directorio;
- buscador;
- encabezado, cuerpo y filas de tabla;
- badges de rol/estado;
- botones de acciones;
- formulario inferior;
- inputs, selects, placeholders y opciones.

### Estadísticas

Se reforzó la paridad oscura de:

- filtros;
- tres KPI principales;
- paneles analíticos;
- tablas/reportes;
- inputs y selects.

El QR mantiene fondo blanco deliberadamente para preservar contraste y lectura.

## Sidebar

Se verificó que `navegacion_aprendiz.css` conserva la imagen local:

`sidebar_campus_20261008.png`

como fondo de la barra lateral izquierda.

## Pruebas ejecutadas

- `node pruebas/prueba_tema_usuarios_estadisticas.js` — OK
- `node pruebas/prueba_sidebar_visual.js` — OK
- `node pruebas/prueba_estadisticas_frontend.js` — OK
- `node pruebas/prueba_estadisticas_analitica.js` — OK
- `node pruebas/prueba_qr_frontend.js` — OK en contrato frontend; el test imprime además el error controlado esperado al simular una respuesta QR inválida.
- parseo CSS de `tema_oscuro_modulos_20261008.css` con `tinycss2` — 0 errores.
- `node --check aplicacion/recursos/JS scripts/aplicacion.js` — OK.

No se modificó lógica de asistencia, persistencia, usuarios ni MySQL para esta corrección visual.
