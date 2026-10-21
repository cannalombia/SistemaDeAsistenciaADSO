# Incidencias verificadas

## BUG-01 · Estado listo pero enrolamiento no disponible

- **Issue:** #8
- **Estado:** abierto; mitigacion temporal verificada, persistencia tras reiniciar WSL pendiente.
- **Sintoma:** la API informaba lector listo, pero el flujo de enrolamiento lo mostraba no disponible.
- **Diagnostico:** conflicto de `fprintd` y permisos del dispositivo. Se recupero temporalmente controlando el servicio y aplicando propietario `root:plugdev` y modo `660`.
- **Validacion positiva:** `usbipd` mostro `05ba:000a` Attached, `lsusb` lo detecto, `fprintd verify` produjo coincidencia, puente `:4318` y Node `:3000` respondieron; el registro mostro “Identidad verificada”.
- **Limite:** no se ha demostrado que los permisos persistan despues de reiniciar WSL2. No cerrar hasta repetir esa prueba.

## BUG-02 · Demostracion incompleta por servidor visual ausente

- **Issue:** #9
- **Estado:** solucion preparada; cierre sujeto a commit publicado.
- **Sintoma:** una extraccion anterior no incluia `pruebas/servidor_visual.js`, por lo que `ABRIR_DEMO_LOCAL.cmd` no podia arrancar.
- **Validacion:** el archivo esta presente en 9.1, maneja `EADDRINUSE` y el conjunto automatizado comprobo 13 paginas y 119 recursos HTTP sin fallos.
- **Alcance:** la demostracion usa datos ficticios; no valida MySQL ni hardware.

## BUG-03 · Sidebar blanca en modulos internos

- **Issue:** #10
- **Estado:** solucion preparada; cierre sujeto a commit publicado y prueba visual.
- **Sintoma:** la navegacion lateral podia quedar con fondo blanco por estilos/caché no uniformes entre paginas.
- **Diagnostico:** referencias de version y reglas compartidas no estaban alineadas en todos los modulos.
- **Validacion:** las pruebas `prueba_sidebar_visual.js`, `prueba_sistema_visual.js` y `prueba_tema_usuarios_estadisticas.js` verifican el fondo local, el ancho uniforme y el tema oscuro. La revision manual final en Edge/Chrome sigue siendo recomendable.

## Resultados negativos que no son defectos abiertos

- Los mensajes `FALLO_SIMULADO`, HTTP 4xx/5xx esperados y un QR deliberadamente invalido pertenecen a pruebas negativas que terminan aprobadas.
- El bloqueo de Chromium automatizado a localhost fue una restriccion del entorno de auditoria, no evidencia de un fallo del sitio.
- No se declara exitosa la asistencia fisica en MySQL: falta la prueba con dedo autorizado, ficha real de prueba y persistencia de extremo a extremo.
