# Backlog BioSecure SENA 9.1

Las historias son necesidades reales del Sistema de Asistencia SENA y se mantienen sincronizadas con GitHub Projects. Las casillas cerradas indican criterios respaldados por el commit y las pruebas enlazadas; no sustituyen las validaciones fisicas que siguen pendientes.

## HU-01 · Estado confiable del lector HID

**Historia:** Como administrador, quiero consultar el estado real del lector DigitalPersona, para no iniciar un registro cuando el hardware o el puente no estan disponibles.

**Etiquetas:** historia, biometria, backend, prioridad-alta · **Estimacion:** M

**Criterios de aceptacion:**

- [x] Dado el puente en modo real y el lector adjunto, cuando consulto `/api/biometria/estado`, entonces recibo `modo: real`, `disponible: true` y `hardware_detectado: true`.
- [x] Dado que WSL2 o el lector no responde, cuando consulto el estado, entonces la interfaz informa indisponibilidad sin anunciar falsamente que esta listo.
- [x] Dado un acceso no autorizado o no local, cuando intenta consultar controles protegidos, entonces la API rechaza la solicitud sin exponer claves ni plantillas.

**Issue:** #2

## HU-02 · Enrolamiento autorizado de huella

**Historia:** Como administrador, quiero enrolar la huella de un aprendiz autorizado, para habilitar su identificacion sin exponer la plantilla biometrica.

**Etiquetas:** historia, biometria, frontend, backend, prioridad-alta · **Estimacion:** M

**Criterios de aceptacion:**

- [x] Dado un administrador autenticado y un aprendiz seleccionado, cuando no se confirma la autorizacion, entonces el sistema no inicia la captura.
- [x] Dado el lector real disponible, cuando se completan las etapas requeridas, entonces la interfaz muestra progreso derivado de capturas confirmadas por el puente.
- [x] Dado un enrolamiento terminado, cuando el servidor confirma el guardado, entonces muestra identidad verificada y conserva la plantilla cifrada solo en el almacenamiento privado.

**Issue:** #3

## HU-03 · Asistencia por identificacion biometrica

**Historia:** Como instructor, quiero identificar por huella a un aprendiz de la ficha activa, para registrar su asistencia una sola vez.

**Etiquetas:** historia, biometria, backend, mysql, prioridad-alta · **Estimacion:** L

**Criterios de aceptacion:**

- [ ] Dado una ficha y jornada abiertas, cuando una huella enrolada se identifica, entonces el servidor emite un ticket de uso unico y corta duracion.
- [ ] Dado un ticket valido, cuando se confirma la asistencia, entonces se registra `presente` una sola vez para el aprendiz identificado.
- [ ] Dado un ticket vencido, reutilizado o de otra ficha, cuando se intenta confirmar, entonces la API rechaza la operacion y no duplica registros.

**Issue:** #4

## HU-04 · Resumen biometrico privado en estadisticas

**Historia:** Como administrador, quiero ver conteos de enrolamiento en Estadisticas, para conocer la cobertura sin consultar nombres, documentos ni plantillas.

**Etiquetas:** historia, frontend, backend, biometria · **Estimacion:** S

**Criterios de aceptacion:**

- [x] Dado un administrador autenticado desde localhost, cuando abre Estadisticas, entonces ve el total enrolado y el modo REAL o MOCK.
- [x] Dado un instructor o una sesion ausente, cuando solicita `/api/biometria/resumen`, entonces recibe una denegacion.
- [x] Dado cualquier respuesta del resumen, cuando se inspecciona su contenido, entonces no contiene nombres, documentos, muestras ni plantillas biometricas.

**Issue:** #5

## HU-05 · Diagnostico y arranque resiliente en Windows y WSL2

**Historia:** Como operador, quiero diagnosticar MySQL, Node.js, WSL2 y el puente biometrico antes de abrir el sistema, para recibir un error accionable sin bloquear QR o registro manual.

**Etiquetas:** historia, backend, biometria · **Estimacion:** M

**Criterios de aceptacion:**

- [x] Dado el entorno Windows 11, cuando ejecuto el diagnostico, entonces comprueba MySQL, credenciales, WSL2, USB, puente y puertos sin imprimir secretos.
- [x] Dado que la biometria no esta disponible, cuando inicia Node.js, entonces QR y asistencia manual siguen accesibles y se informa la limitacion.
- [x] Dado un puerto ocupado o servicio detenido, cuando se ejecuta el arranque, entonces se muestra una accion concreta y se evita un bucle agresivo de reinicio.

**Issue:** #6

## HU-06 · Proteccion de datos biometricos y operativos

**Historia:** Como responsable del tratamiento de datos, quiero excluir secretos, datos personales y plantillas biometricas de Git y del ZIP, para reducir el riesgo de divulgacion.

**Etiquetas:** historia, biometria, docs, prioridad-alta · **Estimacion:** S

**Criterios de aceptacion:**

- [x] Dado un archivo `.env`, una clave o una plantilla `*.bio.json`, cuando se revisa `git status`, entonces el archivo permanece ignorado.
- [x] Dado el resumen o estado biometrico, cuando un cliente autorizado lo consulta, entonces no recibe la plantilla ni datos personales del aprendiz.
- [x] Dado una entrega o commit, cuando se inspeccionan los archivos preparados, entonces no hay CSV operativos, bases, respaldos, credenciales ni registros de asistencia.

**Issue:** #7

## DOC-01 · Historial verificable del desarrollo

**Historia:** Como instructor, quiero consultar una cronologia verificable de BioSecure SENA, para distinguir el trabajo documentado, los commits autenticos y las pruebas que todavia faltan.

**Etiquetas:** docs · **Responsable:** cannalombia · **Estimacion:** S · **Estado del tablero:** Done

**Criterios de aceptacion:**

- [x] Dado el historial real de Git, cuando reviso la cronologia, entonces distingo los commits autenticos de las fechas descritas solo por bitacoras o artefactos.
- [x] Dado un avance documentado, cuando sigo su referencia, entonces encuentro un issue, commit, prueba o documento real del repositorio.
- [x] Dado que existen limites de hardware y MySQL, cuando reviso el cierre, entonces #4 y #8 permanecen abiertos y sus pendientes estan explicados sin afirmar un resultado no probado.
- [x] Dado el trabajo documental terminado, cuando se publique el commit en `main`, entonces #11 se cierra mediante `closes #11` y su tarjeta pasa a Done.

**Issue:** #11

## BUG-01 · API lista pero enrolamiento no disponible

**Estado:** abierto / Todo; mitigacion observada, falta repetir despues de reiniciar WSL2 · **Etiquetas:** bug, biometria, prioridad-alta, pendiente-hardware · **Responsable:** cannalombia

**Criterios de aceptacion:**

- [x] Dado el lector `05ba:000a`, cuando se adjunta a Ubuntu mediante usbipd, entonces `lsusb` y `fprintd verify` lo reconocen.
- [x] Dado el conflicto con `fprintd`, cuando se corrigen propietario `root:plugdev` y permisos `660`, entonces el registro vuelve a mostrar “Identidad verificada”.
- [ ] Dado un reinicio completo de WSL2, cuando se repite el enrolamiento, entonces los permisos persisten y API e interfaz coinciden sin una correccion manual.

**Issue:** #8

## BUG-02 · Servidor visual ausente en una extraccion

**Estado:** cerrado / Done · **Etiquetas:** bug · **Responsable:** cannalombia

**Criterios de aceptacion:**

- [x] Dado el ZIP de demostracion, cuando se ejecuta `ABRIR_DEMO_LOCAL.cmd`, entonces encuentra `pruebas/servidor_visual.js`.
- [x] Dado un puerto ocupado, cuando inicia el servidor visual, entonces informa `EADDRINUSE` de forma accionable.
- [x] Dado el servidor visual activo, cuando se comprueban paginas y recursos locales, entonces las 13 paginas y 119 solicitudes registradas terminan correctamente.

**Issue:** #9

## BUG-03 · Sidebar blanca en vistas internas

**Estado:** cerrado / Done · **Etiquetas:** bug, frontend · **Responsable:** cannalombia

**Criterios de aceptacion:**

- [x] Dado un modulo interno, cuando se carga la navegacion lateral, entonces conserva el fondo y ancho compartidos.
- [x] Dado el modo oscuro, cuando se navega entre Usuarios y Estadisticas, entonces la barra lateral no vuelve a una superficie blanca.
- [x] Dado una revision automatizada, cuando se ejecutan las pruebas visuales, entonces no aparecen regresiones en las reglas compartidas.

**Issue:** #10

## BUG-04 · Panel biometrico claro en modo oscuro

**Estado:** abierto / Todo; validado localmente y publicacion del cambio pendiente · **Tipo:** bug visual, frontend, tema oscuro · **Estimacion:** XS · **Responsable:** cannalombia

**Defecto comprobable:** al abrir Estadisticas con `sena-dark-mode=1`, el resumen “Registro de huellas” conserva una superficie blanca y texto de bajo contraste, aunque los paneles contiguos ya usan el tema oscuro.

**Criterios de aceptacion:**

- [x] Dado que el modo oscuro esta activo, cuando se muestra el resumen de huellas, entonces su fondo, borde y sombra coinciden con las superficies oscuras de Estadisticas.
- [x] Dado que el resumen contiene titulo, estado, nota y recuento, cuando se muestra en modo oscuro, entonces todo el texto conserva contraste legible.
- [x] Dado que el modo claro esta activo, cuando se muestra el resumen, entonces se conserva su apariencia clara actual.

**Validacion local:** `prueba_tema_usuarios_estadisticas.js` y `prueba_sistema_visual.js` aprobadas; render headless de Edge revisado en modo oscuro. La regla nueva esta limitada a `body.dark-mode.statistics-page`, por lo que no altera el tema claro.

**Issue:** #12

## BUG-05 · Telemetria biometrica clara en modo oscuro

**Estado:** abierto / Todo; validado localmente y publicacion del cambio pendiente · **Tipo:** bug visual, frontend, tema oscuro · **Estimacion:** XS · **Responsable:** cannalombia

**Defecto comprobable:** al abrir el panel de huella en Asistencia con `sena-dark-mode=1`, las tarjetas “Flujo activo” y “Estado de captura”, junto con la linea de actividad, conservan superficies blancas.

**Criterios de aceptacion:**

- [x] Dado que el modo oscuro esta activo, cuando se abre Huella digital en Asistencia, entonces las tarjetas de telemetria usan superficies oscuras.
- [x] Dado que la actividad contiene estados normal, exitoso, advertencia o error, cuando se muestra en modo oscuro, entonces conserva contraste y diferenciacion visual.
- [x] Dado que el modo claro esta activo, cuando se abre el mismo panel, entonces se mantienen sus superficies claras actuales.

**Validacion local:** pruebas `prueba_biometria_pro.js`, `prueba_biometria_frontend.js` y `prueba_sistema_visual.js` aprobadas; render headless de Edge revisado. Las reglas nuevas estan limitadas a `body.dark-mode.attendance-page`.

**Issue:** #13
