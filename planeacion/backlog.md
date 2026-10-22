# Backlog BioSecure SENA 9.1

Las historias son necesidades reales del Sistema de Asistencia SENA y se mantienen sincronizadas con GitHub Projects.

## HU-01 · Estado confiable del lector HID

**Historia:** Como administrador, quiero consultar el estado real del lector DigitalPersona, para no iniciar un registro cuando el hardware o el puente no estan disponibles.

**Etiquetas:** historia, biometria, backend, prioridad-alta · **Estimacion:** M

**Criterios de aceptacion:**

- [ ] Dado el puente en modo real y el lector adjunto, cuando consulto `/api/biometria/estado`, entonces recibo `modo: real`, `disponible: true` y `hardware_detectado: true`.
- [ ] Dado que WSL2 o el lector no responde, cuando consulto el estado, entonces la interfaz informa indisponibilidad sin anunciar falsamente que esta listo.
- [ ] Dado un acceso no autorizado o no local, cuando intenta consultar controles protegidos, entonces la API rechaza la solicitud sin exponer claves ni plantillas.

**Issue:** #2

## HU-02 · Enrolamiento autorizado de huella

**Historia:** Como administrador, quiero enrolar la huella de un aprendiz autorizado, para habilitar su identificacion sin exponer la plantilla biometrica.

**Etiquetas:** historia, biometria, frontend, backend, prioridad-alta · **Estimacion:** M

**Criterios de aceptacion:**

- [ ] Dado un administrador autenticado y un aprendiz seleccionado, cuando no se confirma la autorizacion, entonces el sistema no inicia la captura.
- [ ] Dado el lector real disponible, cuando se completan las etapas requeridas, entonces la interfaz muestra progreso derivado de capturas confirmadas por el puente.
- [ ] Dado un enrolamiento terminado, cuando el servidor confirma el guardado, entonces muestra identidad verificada y conserva la plantilla cifrada solo en el almacenamiento privado.

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

- [ ] Dado un administrador autenticado desde localhost, cuando abre Estadisticas, entonces ve el total enrolado y el modo REAL o MOCK.
- [ ] Dado un instructor o una sesion ausente, cuando solicita `/api/biometria/resumen`, entonces recibe una denegacion.
- [ ] Dado cualquier respuesta del resumen, cuando se inspecciona su contenido, entonces no contiene nombres, documentos, muestras ni plantillas biometricas.

**Issue:** #5

## HU-05 · Diagnostico y arranque resiliente en Windows y WSL2

**Historia:** Como operador, quiero diagnosticar MySQL, Node.js, WSL2 y el puente biometrico antes de abrir el sistema, para recibir un error accionable sin bloquear QR o registro manual.

**Etiquetas:** historia, backend, biometria · **Estimacion:** M

**Criterios de aceptacion:**

- [ ] Dado el entorno Windows 11, cuando ejecuto el diagnostico, entonces comprueba MySQL, credenciales, WSL2, USB, puente y puertos sin imprimir secretos.
- [ ] Dado que la biometria no esta disponible, cuando inicia Node.js, entonces QR y asistencia manual siguen accesibles y se informa la limitacion.
- [ ] Dado un puerto ocupado o servicio detenido, cuando se ejecuta el arranque, entonces se muestra una accion concreta y se evita un bucle agresivo de reinicio.

**Issue:** #6

## HU-06 · Proteccion de datos biometricos y operativos

**Historia:** Como responsable del tratamiento de datos, quiero excluir secretos, datos personales y plantillas biometricas de Git y del ZIP, para reducir el riesgo de divulgacion.

**Etiquetas:** historia, biometria, docs, prioridad-alta · **Estimacion:** S

**Criterios de aceptacion:**

- [ ] Dado un archivo `.env`, una clave o una plantilla `*.bio.json`, cuando se revisa `git status`, entonces el archivo permanece ignorado.
- [ ] Dado el resumen o estado biometrico, cuando un cliente autorizado lo consulta, entonces no recibe la plantilla ni datos personales del aprendiz.
- [ ] Dado una entrega o commit, cuando se inspeccionan los archivos preparados, entonces no hay CSV operativos, bases, respaldos, credenciales ni registros de asistencia.

**Issue:** #7
