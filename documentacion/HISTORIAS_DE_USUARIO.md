# Historias de usuario — Sistema de Asistencia SENA

Este documento es la fuente oficial de historias de usuario del proyecto. Los identificadores son permanentes y no deben reutilizarse.

---

## HU-001 — Gestión confiable del ciclo de vida de reportes

**ID:** HU-001

**TÍTULO:** Gestión confiable del ciclo de vida de reportes

**HISTORIA:**

Como Administrador o Coordinador
quiero crear, consultar, archivar, restaurar y eliminar reportes con retención controlada
para conservar evidencia estadística sin comprometer la consistencia de los datos.

**ROL:** Administrador / Coordinador

**ESTADO:** Validada

**PRIORIDAD:** Alta

**CRITERIOS DE ACEPTACIÓN:**

- La creación conserva un snapshot histórico del reporte.
- El archivado, la restauración y la eliminación respetan permisos y transiciones válidas.
- La retención elimina únicamente reportes archivados y no realiza una poda parcial si no hay suficientes candidatos.
- Una retención inviable responde 409 sin persistencia ni auditorías de creación o eliminación.
- Un fallo de persistencia legacy responde 500, conserva el archivo anterior y no registra auditorías de éxito.
- Las mutaciones con persistencia MySQL se serializan y restauran el estado anterior cuando falla el commit.

**IMPLEMENTACIÓN:**

Las reglas de estado, metadata, transición, eliminación, retención y construcción del snapshot están concentradas en `servidor/dominio/reportes.js`. `servidor/servidor.js` coordina HTTP, permisos, persistencia y auditoría. La suite de Reportes incluye instrumentación de cobertura precisa para comprobar la frontera de retención y reproduce el fallo legacy en un directorio temporal aislado.

**ARCHIVOS RELACIONADOS:**

- `servidor/dominio/reportes.js`
- `servidor/servidor.js`
- `pruebas/prueba_modulos.js`
- `pruebas/prueba_reportes.js`
- `pruebas/prueba_persistencia_concurrente.js`
- `MEJORAS_HOY_2026-10-02(1).md`

**PRUEBAS:**

- `node --check pruebas/prueba_reportes.js` — aprobada el 2026-10-07.
- `npm run test:reports` — aprobada el 2026-10-07.
- `npm run test:persistence-concurrency` — aprobada el 2026-10-07.
- `npm test` — suite completa aprobada el 2026-10-07.

**COMMITS RELACIONADOS:**

- `afb82ff` — feat: completar administracion de reportes
- `2726342` — fix: serializar persistencia y proteger rollback concurrente
- `d0bb011` — refactor: extraer estado y metadatos de reportes
- `63a320f` — refactor: extraer mutaciones de archivo de reportes
- `369c0e0` — refactor: extraer retencion segura de reportes
- `d48e853` — refactor: extraer construccion de snapshot de reportes
- `129a5d6` — test(reportes): conserva evidencia de retencion y fallo legacy
- `9311114` — docs(reportes): registra cierre formal del bloque 51

**ÚLTIMA ACTUALIZACIÓN:** 2026-10-07

**OBSERVACIONES:**

El modo legacy conserva una limitación conocida: si la persistencia falla después de mutar la colección en memoria, el archivo queda intacto pero la memoria mantiene el estado provisional. Las lecturas GET también permanecen fuera de la cola global de mutaciones MySQL.

---

## HU-002 — Identidad institucional animada en la navegación

**ID:** HU-002

**TÍTULO:** Identidad institucional animada en la navegación

**HISTORIA:**

Como usuario del Sistema de Asistencia SENA
quiero visualizar la identidad institucional animada en la navegación
para disponer de una interfaz coherente, reconocible y accesible.

**ROL:** Administrador / Coordinador / Instructor / Aprendiz

**ESTADO:** Implementada

**PRIORIDAD:** Media

**CRITERIOS DE ACEPTACIÓN:**

- El logo animado aparece en el menú lateral de gestión y en el portal del aprendiz.
- El video se reproduce automáticamente, en silencio, en bucle y sin controles.
- El logo conserva un tamaño estable y no altera la posición del menú lateral.
- Si el MP4 falla, se muestra el PNG institucional como fallback.
- Si el usuario prefiere movimiento reducido, se oculta el video y se muestra el fallback estático.
- El servidor entrega el recurso con estado HTTP 200 y tipo `video/mp4`.

**IMPLEMENTACIÓN:**

La navegación compartida construye un elemento `video` con poster y fallback PNG, controla errores de carga y respeta `prefers-reduced-motion`. Los estilos mantienen las dimensiones del logo en escritorio y ajustes, y el servidor publica archivos MP4 desde un directorio dedicado con el MIME correspondiente.

**ARCHIVOS RELACIONADOS:**

- `aplicacion/recursos/JS scripts/navegacion.js`
- `aplicacion/recursos/estilos CCS/base.css`
- `aplicacion/recursos/estilos CCS/navegacion_aprendiz.css`
- `aplicacion/recursos/video/video sena logo.mp4`
- `servidor/configuracion/rutas.js`
- `servidor/servidor.js`
- `pruebas/prueba_proyecto.js`

**PRUEBAS:**

- `node --check aplicacion/recursos/JS scripts/navegacion.js` — aprobada el 2026-10-07.
- `node --check servidor/configuracion/rutas.js` — aprobada el 2026-10-07.
- `node --check servidor/servidor.js` — aprobada el 2026-10-07.
- `node --check pruebas/prueba_proyecto.js` — aprobada el 2026-10-07.
- `node pruebas/prueba_proyecto.js` — aprobada el 2026-10-07; comprobó estructura, fallback, existencia, HTTP 200 y MIME `video/mp4`.
- `npm test` — suite completa aprobada el 2026-10-07.

**COMMITS RELACIONADOS:**

- `0e94a3e` — feat(ui): integra identidad institucional animada

**ÚLTIMA ACTUALIZACIÓN:** 2026-10-07

**OBSERVACIONES:**

La validación automatizada comprueba estructura, fallback, existencia del recurso, respuesta HTTP y MIME. La reproducción visual en navegadores y dispositivos reales no se declara validada hasta realizar una prueba manual específica.
