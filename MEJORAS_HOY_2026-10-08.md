# Mejoras del 08/10/2026 — Estadísticas e informes

## Banner vivo de seguimiento

Se sustituyó el banner estático del módulo `estadisticas.html` por una composición interactiva inspirada en el prototipo visual aprobado. El banner ya no muestra métricas decorativas: escucha el evento `dashboard:data`, alimentado por `GET /api/statistics`, y representa datos reales del rango y ficha seleccionados.

- Asistencia: utiliza `summary.attendance` y `summary.attendanceDelta`.
- Ausencias: utiliza `distribution.percentages.ausente` y `distribution.counts.ausente`.
- Tendencia: la línea, nodos y barras utilizan los últimos valores de `trend`.
- Estado de conexión: refleja carga correcta y eventos `online` / `offline` del navegador.
- Interacciones: los tres accesos del banner desplazan a evolución diaria, distribución y reportes guardados.
- Animación: partículas, ondas, pulso de conexión, trazo de tendencia y contadores se ejecutan con CSS/JavaScript y respetan `prefers-reduced-motion`.
- Responsive: se definieron composiciones específicas para escritorio, tableta y móvil.
- Modo oscuro: el banner mantiene el mismo lenguaje visual tecnológico y el contraste del módulo.

## Recuperación del error `Failed to fetch`

Se reforzó la comunicación del frontend de Estadísticas con la API sin modificar la arquitectura del backend ni la persistencia MySQL.

- `estadisticas.js`: timeout de 12 s, un reintento automático para fallos transitorios de red y botón manual **Reintentar** si la API continúa inaccesible.
- Las cancelaciones intencionales producidas al cambiar rápidamente filtros siguen tratándose como `AbortError` y no generan falsas alertas.
- `reportes.js`: las consultas GET y descargas cuentan con timeout y reintento controlado. Las operaciones mutables POST/PATCH/DELETE no se repiten automáticamente para evitar duplicar acciones.
- `asistencia_qr.js`: un fallo de red ya no expone el texto técnico `Failed to fetch`; mantiene su recuperación controlada existente.

## Arranque del proyecto

`ABRIR_PROYECTO.cmd` ahora diferencia las causas comunes de arranque:

- verifica Node.js;
- informa claramente si falta `.env`;
- instala dependencias automáticamente cuando `node_modules` no existe;
- si el servidor falla, muestra las últimas líneas de `datos/servidor_errores.log` en vez de indicar siempre que falta Node.js.

## Validación específica añadida

Se agregó `pruebas/prueba_estadisticas_frontend.js`, que comprueba:

- presencia del banner vivo;
- conexión de métricas a datos reales del dashboard;
- reintento automático ante una caída simulada de `fetch`;
- ausencia del mensaje técnico `Failed to fetch` en la interfaz;
- disponibilidad del botón manual **Reintentar**.

La prueba específica fue ejecutada correctamente el 08/10/2026.

---

# Fase 1 — Analítica interactiva y carga automática del último corte

## Carga automática de Estadísticas

El módulo ya no exige que el administrador seleccione un periodo para ver información útil al entrar. `estadisticas.js` busca el registro de asistencia más reciente con ventanas progresivas de 7, 30, 90 y hasta 366 días y, al encontrar actividad, carga una ventana de siete días terminada en esa fecha.

La vista se identifica como **Vista automática · últimos registros guardados** y se refresca periódicamente mientras no exista una selección manual. Si el usuario cambia fechas/rango/periodo, su selección pasa a ser la fuente de verdad hasta que vuelva a solicitar la vista automática.

## Analítica Fase 1

Se agregó `estadisticas_analitica.js` para construir, sin librerías externas:

- Evolución diaria en SVG, con huecos reales para días sin registros, volumen, tooltip, teclado y selección.
- Distribución de estados en donut SVG, con leyenda accesible y selección de estado.
- Composición por ficha con barras apiladas, orden por asistencia/ausencias/tardanzas y Top 5/10/Todas.
- Selección cruzada única `{estado, ficha, dia}`, chips activos y limpieza con `Esc`.
- Movimiento de entrada y reordenamiento con alternativa inmediata si View Transitions no está disponible.
- Soporte de `prefers-reduced-motion`, modo claro/oscuro y responsive móvil.

No se activaron anomalías/riesgo ni comparaciones con periodos anteriores.

## Corrección visual — Fecha de Asistencia

Se eliminó el calendario decorativo duplicado que se superponía al texto de `input[type=date]`. Se conserva el selector nativo a la derecha, con padding y `color-scheme` adecuados en modo claro y oscuro.

## Validación QR con ocho fichas

Se corrigió el catálogo operativo usado por el QR. `attendanceFichas()` ahora parte de las fichas activas configuradas en formación y después combina aprendices activos como compatibilidad. De esta forma el administrador puede generar QR para las ocho fichas operativas **3349882 a 3349889** aunque una ficha todavía no tenga asistencia registrada ese día.

La ficha histórica **3349881** se conserva íntegra para trazabilidad y relaciones históricas, pero no aparece en el catálogo QR diario porque está identificada con `restauradaDesdeHistorico: true`. Esto evita confundir la ficha histórica con las ocho fichas operativas actuales.

Se actualizaron `prueba_qr_frontend.js` y `prueba_escala.js` para comprobar expresamente la octava ficha operativa, **3349889**, y la generación del QR.

## Rediseño central de los módulos del personal

El cambio visual del menú lateral se implementó en la capa compartida, no copiando CSS dentro de cada página. Por eso el mismo diseño se aplica a **Estadísticas, Asistencia, Crear usuario, Programa de formación, Fichas, Horario, Ambientes y Configuración**.

- Fondo vertical local `sidebar_campus_20261008.png`, integrado con la identidad azul `#003B5C`.
- Tarjetas de navegación con borde tecnológico, vidrio oscuro, estados hover/focus y activo con iluminación verde.
- Indicador lateral con chevrón en módulos y Cerrar sesión.
- El fondo y la navegación funcionan sin recursos remotos.
- `prueba_sidebar_visual.js` verifica que las ocho páginas usan la navegación compartida y que el recurso visual viaja dentro del proyecto.

## Carga automática del último corte

Se conserva la carga automática ya implementada en Estadísticas. Al abrir como administrador, el frontend busca la fecha de asistencia más reciente y carga una ventana terminada en ese último registro. No es necesario seleccionar primero un periodo para ver datos.

## Compatibilidad recuperada en Estadísticas

Durante la validación completa se detectó una regresión heredada: `prueba_logica_aprendida.js` todavía comprueba `calcular_extremos`, pero el helper había desaparecido de `estadisticas.js` durante el rediseño. Se restauró la función con recorrido iterativo y `drawSparkline()` vuelve a usarla. Esto mantiene compatibilidad con la lógica anterior y evita expandir arreglos grandes en `Math.min(...valores)` / `Math.max(...valores)`.

La prueba de lógica volvió a quedar aprobada.

## Evidencia y commits pendientes

Se creó `documentacion/EVIDENCIA_COMMITS_2026-10-08.md` con el desglose preparado para que Codex haga commits separados y trazables del banner/analítica, navegación de módulos, QR de ocho fichas y la referencia histórica de la corrección #12 de la ficha 3349881. No se ejecutaron `git add`, `git commit` ni `git push` desde este ZIP porque el paquete no incluye el directorio `.git`.


======================================================================
CORRECCIÓN VISUAL V2 — 08/10/2026
======================================================================
- Estadísticas: los KPI Aprendices con registros, Fichas con registros y Porcentaje de presentes adoptan el sistema visual de las tarjetas de Crear usuario.
- Crear usuario: modo oscuro integral para importación, directorio, tabla, buscador y formulario.
- Tema: restauración temprana de `sena-dark-mode` para evitar superficies blancas durante la carga.
- Sidebar: se conserva y valida `sidebar_campus_20261008.png` en el lateral izquierdo.
- Pruebas: nueva `prueba_tema_usuarios_estadisticas.js`, incluida en `npm test`.
- Suite completa: EXIT 0 en harness aislado.

## Corrección de instancia activa y modo oscuro — 08/10/2026

Se detectó que el supervisor reutilizaba una instancia saludable de Blue Magic en localhost:3000 aunque perteneciera a otra carpeta/versión. Se añadió BUILD_ID, validación de proceso y reinicio automático de la copia anterior. Esto garantiza que los cambios visuales del modo oscuro de Crear usuario sean los archivos realmente servidos por localhost.
