# BLUE MAGIC V5 — Informe técnico de analítica y estabilización UI

**Fecha:** 08/10/2026
**Alcance ejecutado:** Fase 1 del rediseño de Estadísticas e informes, carga automática del último corte disponible, corrección visual del campo Fecha y validación del selector QR con ocho fichas.

## 1. Estado de partida conservado

Se trabajó sobre la versión en la que ya estaban aprobados visualmente el banner interactivo, el modo oscuro de Estadísticas/Asistencia, el logo animado continuo y la corrección funcional del QR. No se modificaron el backend estadístico, `statisticsPayload()`, el dominio, el esquema MySQL, la cola de concurrencia, la generación de reportes/PDF, el mecanismo de tema, el video/logo ni la implementación de producción del QR.

## 2. Carga automática de la información más reciente

Al entrar a **Estadísticas e informes**, el administrador ya no necesita escoger manualmente un periodo para ver información útil.

El frontend consulta el endpoint existente `/api/statistics` y localiza el registro de asistencia más reciente disponible, usando ventanas progresivas de 7, 30, 90 y hasta 366 días. Cuando encuentra actividad, carga automáticamente una ventana de siete días terminada en la fecha de ese último registro.

Comportamiento:

- Si hoy existe asistencia guardada, el panel abre con el corte que incluye hoy.
- Si hoy aún no existe asistencia, abre con el último registro realmente guardado, en lugar de mostrar cifras inventadas o un cero falso.
- Si mañana se registra una asistencia nueva, la vista automática puede avanzar a ese nuevo corte al refrescar.
- El refresco automático se realiza cada 30 segundos mientras el usuario mantenga la vista automática.
- Si el usuario cambia manualmente fechas, periodo o un rango rápido, se respeta su selección y deja de imponerse el rango automático.
- Cambiar la ficha vuelve a buscar el último corte disponible para esa ficha.
- El estado visual indica si se está usando **Vista automática · últimos registros guardados** o un rango seleccionado manualmente.

No se cambió la fórmula de asistencia ni se recalculó una segunda estadística en el navegador. Las cifras siguen llegando del payload oficial del servidor.

## 3. Fase 1 — Analítica interactiva

### Evolución diaria

Se reemplazó la representación básica por un SVG propio, sin librerías externas.

- Línea de asistencia diaria y área suave.
- Barras tenues de volumen de registros.
- Los días sin registros quedan como huecos; no se representan como 0 %.
- Tooltip con fecha, presentes, tardanzas, ausentes, justificados, total y porcentaje cuando esos datos existen en el payload.
- Selección por clic/tap.
- Navegación por teclado con flechas, `Enter` y `Esc`.
- Capa de captura de puntero única para localizar el día más cercano, evitando un listener por cada punto.

### Distribución de estados

- Donut SVG construido con `stroke-dasharray`.
- Total y asistencia al centro.
- Leyenda operativa con Presentes, Tardanzas, Ausentes y Justificados.
- Cada estado es un botón accesible con `aria-pressed`.
- Seleccionar un estado actualiza la lectura cruzada de los demás módulos.
- Se comprueba que la suma de estados coincida con el total; una inconsistencia se reporta en consola de desarrollo.
- Se incluye la ayuda **¿Cómo se calcula la asistencia?**, basada en la fórmula que ya entrega el sistema.

### Composición por ficha

- Barras horizontales apiladas por estado.
- Código de ficha, programa cuando está disponible, total y porcentaje de asistencia.
- Orden por mayor asistencia, menor asistencia, más ausencias o más tardanzas.
- Vistas Top 5, Top 10 y Todas.
- Selección con ratón, táctil o teclado.
- La ficha seleccionada se comunica con el filtro oficial del dashboard, sin crear una segunda fuente de verdad.

### Selección cruzada

La analítica usa un único estado interno `{estado, ficha, dia}`.

- Seleccionar un estado prioriza esa lectura en evolución y composición.
- Seleccionar una ficha aplica el filtro real del dashboard y recalcula las cifras con `/api/statistics`.
- Seleccionar un día lo deja visible como filtro analítico.
- Los filtros activos aparecen como chips y pueden limpiarse de forma conjunta.
- `Esc` limpia la selección analítica.

## 4. Movimiento, responsive y accesibilidad

- Animación de entrada de línea, donut, barras y cifras sin alterar el valor final.
- Transiciones breves de selección y reordenamiento.
- `prefers-reduced-motion` desactiva las animaciones no esenciales.
- `prefers-contrast` aumenta la definición visual cuando el navegador lo solicita.
- `ResizeObserver` redibuja la visualización cuando cambia el tamaño del módulo.
- Pointer Events unifican ratón y táctil.
- View Transitions se usa solo como mejora progresiva; si no existe, el contenido se actualiza directamente.
- Paridad de modo claro y oscuro.
- A 390 px no existe desbordamiento horizontal de la página; los elementos amplios administran su espacio dentro del módulo.

No se añadieron dependencias de producción ni una librería de gráficas.

## 5. Corrección del campo Fecha en Asistencia

La superposición observada provenía de tener simultáneamente un icono de calendario personalizado a la izquierda y el selector nativo de `input[type=date]`.

Corrección aplicada:

- se retiró únicamente el icono decorativo duplicado del campo Fecha;
- se conserva el calendario nativo del navegador a la derecha;
- se ajustó el padding del control;
- se definió `color-scheme` para que el selector nativo mantenga coherencia en modo claro y oscuro.

Resultado: fecha y calendario quedan separados y legibles, sin superposición.

## 6. QR y ocho fichas

No se modificó el código de producción del QR porque esa corrección ya estaba aprobada y el alcance actual exige no reabrirla.

Se amplió la prueba del frontend QR para simular ocho fichas disponibles y se verificó que:

- el selector carga las ocho opciones recibidas de `/api/attendance`;
- puede escogerse la octava ficha;
- al generar el QR, el `POST /api/attendance/qr` envía exactamente la ficha elegida y la jornada elegida;
- el contrato de imagen, URL y expiración permanece validado.

**Condición operativa:** el servidor solo ofrece fichas que tienen aprendices activos asociados. Por tanto, para ver ocho fichas en la instalación real, la base MySQL debe tener esas ocho fichas efectivamente asociadas a aprendices activos. No se crean fichas ficticias desde el frontend.

La política actual del servidor mantiene un QR activo por sesión de personal: generar otro revoca el anterior. Esta validación cubre generar QR para cualquiera de las ocho fichas de forma secuencial, no ocho QR simultáneamente activos.

## 7. Archivos funcionales modificados

- `aplicacion/paginas HTML/estadisticas.html`
- `aplicacion/paginas HTML/asistencia.html`
- `aplicacion/recursos/JS scripts/estadisticas.js`
- `aplicacion/recursos/JS scripts/estadisticas_informes.js`
- `aplicacion/recursos/JS scripts/estadisticas_analitica.js` (nuevo)
- `aplicacion/recursos/estilos CCS/estadisticas_reportes.css`
- `aplicacion/recursos/estilos CCS/paneles_academicos.css`
- `pruebas/prueba_estadisticas_frontend.js`
- `pruebas/prueba_estadisticas_analitica.js` (nuevo)
- `pruebas/prueba_qr_frontend.js`
- `package.json` (incorpora la prueba analítica al comando `npm test`)

El banner interactivo y la recuperación de `Failed to fetch` ya presentes en esta base se conservaron.

## 8. Pruebas ejecutadas en este entorno

### Aprobadas

- `node --check` de los JavaScript modificados.
- `node pruebas/prueba_estadisticas_frontend.js` — APROBADO.
- `node pruebas/prueba_estadisticas_analitica.js` — APROBADO.
- `node pruebas/prueba_qr_frontend.js` — APROBADO.
- Parseo CSS sin errores sintácticos.
- Validación HTML estructural y de IDs duplicados.
- Validación visual real con Chromium/Playwright:
  - claro 1366×768;
  - oscuro 1366×768;
  - claro 390×844;
  - oscuro 390×844.
- Sin error de página ni desbordamiento horizontal global en las capturas verificadas.
- Navegación de Evolución por teclado.
- Selección interactiva de estado y ficha.
- `prefers-reduced-motion` comprobado.
- Campo Fecha verificado visualmente sin superposición.

Las capturas de evidencia fueron generadas fuera de la carpeta del proyecto para no contaminar la entrega.

### No verificadas aquí

No fue posible completar `npm ci` en el entorno de construcción por límite/indisponibilidad de instalación de dependencias. Por esa causa, no se declara como ejecutada en este entorno la suite integral que necesita módulos externos:

- `npm test`
- `npm run test:reports`
- `npm run test:persistence-concurrency`

Esto debe ejecutarse en el PC del proyecto después de `npm.cmd install`. No se clasifica como fallo funcional de las modificaciones.

## 9. Coherencia de datos

Los nuevos módulos consumen directamente `timeline`, `distribution`, `composition`, `records` y `summary` del payload existente. No redefinen `rateFor()` ni crean una fórmula paralela.

Reportes sigue persistiendo el mismo payload estadístico y PDF sigue usando el snapshot ya existente. La coherencia estructural se conserva por diseño al no modificar `statisticsPayload()` ni Reportes. La comparación runtime dashboard ↔ reporte guardado ↔ PDF debe cerrarse con la suite integral en la instalación local.

## 10. Elementos omitidos intencionalmente

- **Hallazgos del periodo:** corresponde a Fase 2 y no se implementó antes de cerrar Fase 1.
- **Comparación con periodo anterior:** Fase 3; no autorizada porque implica cambiar el payload/snapshot/PDF/pruebas de Reportes.
- **Indicadores automáticos de riesgo/anomalía:** no se activaron porque no existe un umbral aprobado.
- **Panel de detalle adicional de ficha:** no se añadió para no inventar información ni ampliar alcance sin necesidad.

### Regla de atención PROPUESTA, no activa

Solo como propuesta para aprobación futura: considerar un día de atención cuando tenga al menos 10 registros válidos y su porcentaje de asistencia quede 15 puntos porcentuales o más por debajo del promedio del periodo seleccionado. Esta regla **NO está activada en el código**.

## 11. Compatibilidad web

- CSS Grid/Flex, custom properties, Pointer Events y `prefers-reduced-motion`: uso directo con soporte moderno amplio.
- `ResizeObserver`: uso para adaptación del módulo.
- View Transitions: mejora progresiva; si no está disponible se usa actualización normal sin pérdida funcional.
- SVG/CSS propio: no depende de CDN ni librería de gráficos para la analítica.

Existe una referencia Font Awesome heredada en páginas del proyecto anterior a este trabajo. No fue añadida por esta implementación.

## 12. Plan de commits para Codex / GitHub

**No se ejecutaron `git add`, `commit` ni `push`.** El ZIP no contiene `.git`, por lo que los siguientes nombres quedan preparados como plan para que Codex inspeccione el diff real del repositorio y cree evidencia en commits separados:

1. `Implementar #006 - feat(ui): banner estadístico con datos reales`
2. `Corregir #007 - fix(ui): recuperación de consultas estadísticas`
3. `Rediseñar #008 - feat(ui): analítica interactiva de asistencia`
4. `Corregir #009 - fix(ui): campo fecha sin superposición`
5. `Validar #010 - test(ui): analítica y selector QR de ocho fichas`
6. `Documentar #011 - docs(general): evidencia de mejoras visuales`

Codex debe crear solo los commits que correspondan realmente al diff pendiente del repositorio. Si banner o recuperación de red ya están versionados, no debe duplicarlos.

## 13. Estado final de esta entrega

**LISTO PARA VALIDACIÓN LOCAL / PRE-ENTREGA.**

Bloque funcional nuevo verificado con pruebas específicas y navegador. Antes de declarar el proyecto completo como entrega final, ejecutar en el PC real las suites npm indicadas y realizar una prueba manual con MySQL: guardar una asistencia nueva, entrar a Estadísticas y confirmar que la vista automática avanza al último registro; luego generar un QR seleccionando cada ficha operativa necesaria.
