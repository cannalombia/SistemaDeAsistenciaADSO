# AJUSTE VISUAL — ESTADISTICAS EN MOVIMIENTO

Build: `2026-10-12-stats-motion-v1`

## Cambios aplicados

- Se reforzó la jerarquía tipográfica de:
  - `TENDENCIA TEMPORAL`
  - `COMPARACION OPERATIVA`
- Se ampliaron los títulos y textos de apoyo de los modulos analiticos.
- Se agregaron animaciones ambientales y constantes en:
  - grafica `Evolucion diaria`
  - modulo `Distribucion de estados`
  - bloque `Composicion por ficha`
- Se implementó un recorrido visual automatico para que los modulos se perciban activos sin necesidad de recargar manualmente.
- Se amplió la ventana automatica del dashboard para mostrar un rango mayor de datos recientes.
- Se sembraron registros historicos adicionales para la semana `2026-10-05` a `2026-10-09`, con el fin de mantener el panel con actividad visible.

## Archivos principales modificados

- `aplicacion/recursos/estilos CCS/estadisticas_reportes.css`
- `aplicacion/recursos/JS scripts/estadisticas_analitica.js`
- `aplicacion/recursos/JS scripts/estadisticas.js`
- `datos/asistencia.json`

## Validacion basica realizada

- `node --check` sobre los JS modificados: OK.

## Nota

- No se toco la logica tecnica del QR.
- El movimiento agregado es visual y esta pensado para verse moderno sin perder legibilidad.
