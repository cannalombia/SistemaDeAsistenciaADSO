# Historial verificable del 16 al 23 de octubre de 2026

Esta bitacora describe el trabajo conservado en archivos y pruebas. No sustituye ni retrodata commits. Cuando una fecha no tiene commit propio se indica como evidencia documental o cronologia inferida. El ultimo commit autenticado anterior a la integracion 9.1 es `c975bce`, del 15 de octubre de 2026.

| Fecha | Tipo de evidencia | Avance y problemas |
|---|---|---|
| 16/10/2026 | Cronologia inferida de los artefactos 8.9/9.1 | Se delimito la integracion HID sobre Windows 11 + WSL2 Ubuntu 24.04, con Node en `:3000` y puente Python en `:4318`. No existe commit publicado de ese dia en el historial inspeccionado. |
| 17/10/2026 | Evidencia documental importada el 21/10 | Los documentos y pruebas de la entrega describen el flujo libfprint, almacenamiento cifrado, enrolamiento y asistencia por ticket de un solo uso. No existe un commit publicado del 17/10 y las pruebas logicas no demuestran captura fisica completa. |
| 18/10/2026 | Cronologia inferida | Se trabajo en seguridad local, reconexion, cancelacion y mensajes de indisponibilidad. No hay commit fechado ese dia; los archivos llegaron como extraccion 9.1 sin metadatos Git propios. |
| 19/10/2026 | Evidencia documental importada el 21/10 | El README y los documentos 8.9.1 identifican el build `version-8.9.1-biosecure-premium-motion-20261019`, la interfaz de enrolamiento y el limite de homologacion con hardware/MySQL. No hay un commit publicado del 19/10. |
| 20/10/2026 | Cronologia inferida | Se prepararon diagnosticos de MySQL, credenciales, rutas WSL y arranque resiliente. No se presenta esta entrada como commit. |
| 21/10/2026 | Evidencia directa del entorno y suite | `05ba:000a` fue Attached, visible en `lsusb`; `fprintd verify` encontro coincidencia; puente y Node respondieron; `/api/biometria/estado` reporto modo real/disponible/hardware. El enrolamiento mostro “Identidad verificada” despues de controlar `fprintd` y permisos `root:plugdev 660`. `npm test` y las pruebas Python fueron registradas como aprobadas en la auditoria 9.1. Persistencia tras reinicio WSL y asistencia fisica guardada en MySQL siguen pendientes. |
| 22/10/2026 | Commits Git autenticos | Se incorporaron la verificacion previa a despliegue (`63f299e`), la restriccion de CORS (`edb33c8`), el refuerzo de HTTPS y cookies (`fc6bdb4`) y la guia de preparacion para produccion (`1bde09e`). Estos cambios pertenecen al despliegue y no prueban la biometria fisica. |
| 23/10/2026 | Cambios locales y verificacion actual | Se corrigieron localmente dos defectos visuales del modo oscuro en Estadisticas y Asistencia. Las pruebas focalizadas y `npm test` terminaron con codigo 0 fuera del sandbox; BUG-04 y BUG-05 deben permanecer sin cerrar hasta que sus cambios se publiquen. Se actualizo la trazabilidad del 16 al 23 bajo #11. |

## Historial Git autentico relacionado

- `c975bce` — 15/10/2026 — Uniformar ancho del menu lateral.
- `e61ba9d` — 15/10/2026 — Redirigir GitHub Pages al servidor local.
- `fff4d0c` — 15/10/2026 — Corregir proporcion del logo de acceso.
- Los cambios 9.1 estaban fuera de Git al iniciar esta integracion; sus commits se crean con la fecha actual real y se enlazan a issues reales.
- `a789cd9` — 21/10/2026 — integracion legitima de BioSecure 9.1; cierra #2, #3, #5, #6, #7, #9 y #10, y referencia #4 sin cerrarlo.
- `df9dcb1` — 21/10/2026 — publica plantillas, backlog, issues, tablero y evidencias de planeacion.
- `63f299e`, `edb33c8`, `fc6bdb4`, `1bde09e` — 22/10/2026 — preparacion y documentacion de despliegue.
- `e68d297` — 23/10/2026 — documentacion verificable, backlog, incidencias, entrega y verificador relacionados con #11, #12 y #13.
- `b0c6986` — 23/10/2026 — cierre trazable de #11 mediante `closes #11`; GitHub movio su tarjeta a Done.

## Limites comprobados

- No existen commits publicados del 16, 17, 18, 19 o 20 de octubre. Esos dias solo se describen con el nivel de evidencia indicado en la tabla.
- La deteccion real del lector y una coincidencia con `fprintd` no equivalen a una asistencia completa.
- #4 sigue abierto hasta identificar una huella autorizada y confirmar una sola asistencia persistida en MySQL.
- #8 sigue abierto hasta reiniciar WSL2 y comprobar que el permiso del USB y la captura se conservan.
- No se publican capturas con datos personales, plantillas, claves, `.env` ni registros operativos.
