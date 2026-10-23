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
- **Estado:** cerrado / Done por `a789cd9`.
- **Sintoma:** una extraccion anterior no incluia `pruebas/servidor_visual.js`, por lo que `ABRIR_DEMO_LOCAL.cmd` no podia arrancar.
- **Validacion:** el archivo esta presente en 9.1, maneja `EADDRINUSE` y el conjunto automatizado comprobo 13 paginas y 119 recursos HTTP sin fallos.
- **Alcance:** la demostracion usa datos ficticios; no valida MySQL ni hardware.

## BUG-03 · Sidebar blanca en modulos internos

- **Issue:** #10
- **Estado:** cerrado / Done por `a789cd9`; las pruebas automatizadas quedaron registradas y la revision manual sigue siendo recomendable.
- **Sintoma:** la navegacion lateral podia quedar con fondo blanco por estilos/caché no uniformes entre paginas.
- **Diagnostico:** referencias de version y reglas compartidas no estaban alineadas en todos los modulos.
- **Validacion:** las pruebas `prueba_sidebar_visual.js`, `prueba_sistema_visual.js` y `prueba_tema_usuarios_estadisticas.js` verifican el fondo local, el ancho uniforme y el tema oscuro. La revision manual final en Edge/Chrome sigue siendo recomendable.

## BUG-04 · Resumen de huellas blanco en modo oscuro

- **Issue:** #12.
- **Estado:** abierto / Todo; correccion validada localmente y publicacion del cambio pendiente.
- **Sintoma:** en Estadisticas, el resumen “Registro de huellas” conserva fondo blanco y texto casi blanco al activar el modo oscuro.
- **Diagnostico:** el componente se agrego despues del refuerzo oscuro de Estadisticas y no quedo incluido en sus selectores de superficie y tipografia.
- **Validacion:** `prueba_tema_usuarios_estadisticas.js`, `prueba_sistema_visual.js` y `prueba_resumen_biometrico_91.js` aprobadas. El render headless de Edge confirmo superficie oscura y texto legible; el modo claro permanece fuera del alcance de los selectores nuevos.

## BUG-05 · Telemetria de asistencia biometrica blanca en modo oscuro

- **Issue:** #13.
- **Estado:** abierto / Todo; correccion validada localmente y publicacion del cambio pendiente.
- **Sintoma:** las tarjetas “Flujo activo”, “Estado de captura” y la linea de actividad permanecen claras dentro del panel oscuro de asistencia biometrica.
- **Diagnostico:** las reglas claras agregadas al final de `biometria_89.css` sobrescriben las superficies oscuras base y no tienen una contraparte posterior limitada a `body.dark-mode`.
- **Validacion:** `prueba_biometria_pro.js`, `prueba_biometria_frontend.js` y `prueba_sistema_visual.js` aprobadas. El render headless de Edge confirmo tarjetas, actividad y estados con contraste oscuro; el tema claro queda fuera de los selectores agregados.

## Resultados negativos que no son defectos abiertos

- Los mensajes `FALLO_SIMULADO`, HTTP 4xx/5xx esperados y un QR deliberadamente invalido pertenecen a pruebas negativas que terminan aprobadas.
- El bloqueo de Chromium automatizado a localhost fue una restriccion del entorno de auditoria, no evidencia de un fallo del sitio.
- No se declara exitosa la asistencia fisica en MySQL: falta la prueba con dedo autorizado, ficha real de prueba y persistencia de extremo a extremo.
