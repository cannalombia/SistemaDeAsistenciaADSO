# Arquitectura actual de Blue Magic V5

Estado consolidado: 2026-10-04.

Blue Magic V5 es un monolito modular por capas construido con Node.js, interfaz
web y MySQL 8.4 LTS como persistencia operacional. Su evolución aplica de forma
gradual principios de Puertos y Adaptadores mediante extracciones pequeñas,
cohesivas y verificadas. No utiliza microservicios ni añade infraestructura que
el alcance actual no necesita.

## Capas y responsabilidades

### Interfaz web

Las páginas viven en `aplicacion/paginas HTML` y sus scripts en
`aplicacion/recursos/JS scripts`. `autenticacion.js` consulta la sesión,
`navegacion.js` construye el menú según el rol y cada pantalla consume la API.
El navegador no persiste usuarios, contraseñas ni el estado operacional.

### Rutas HTTP

`servidor/rutas` separa el despacho por área:

- `acceso.js`: autenticación, sesión, perfil y recuperación;
- `usuarios.js`: aprendices, directorio, importación y exportación;
- `formacion.js`: programas, fichas, horarios, ambientes, asistencia, excusas,
  estadísticas y reportes;
- `sistema.js`: health, auditoría, notificaciones y respaldos.

Las rutas traducen método y URL hacia controladores. La autenticación,
autorización por rol, lectura del cuerpo, códigos HTTP y respuestas permanecen
en la capa de coordinación.

### Coordinación de casos de uso

`servidor/servidor.js` compone dependencias y coordina los casos de uso. Allí se
mantienen el estado compartido en memoria, la autenticación, las llamadas al
dominio, la persistencia, la auditoría y la respuesta HTTP. Su tamaño es deuda
técnica aceptada, no un defecto bloqueante.

### Dominio

`servidor/dominio` contiene reglas cohesivas que no conocen HTTP ni realizan
I/O:

- `usuarios.js`: normalización de roles, estados y filas persistibles;
- `programas.js`: normalización, presentación y validación de programas;
- `estadisticas.js`: fechas, rangos y resúmenes estadísticos;
- `reportes.js`: snapshot y ciclo de vida de reportes.

### Módulos técnicos

`servidor/modulos` reúne adaptadores y utilidades de infraestructura: HTTP,
correo, persistencia de archivos legacy, SQLFILE, respaldos, transacciones de
archivos, lectura de excusas y generación de PDF.

### Persistencia MySQL

`servidor/base_datos` contiene configuración, conexión, migraciones y el
repositorio MySQL. `DATA_SOURCE=mysql` y la marca
`app_settings.source_definitive=mysql` identifican el corte operacional. La
aplicación usa una cuenta de permisos mínimos; migraciones y tareas de esquema
usan una cuenta separada. `DB_NAME_TEST` debe ser distinta de `DB_NAME`.

CSV y JSON permanecen únicamente como legado, respaldo o recuperación
controlada. No son la fuente operacional activa.

## Consistencia de mutaciones MySQL

Las solicitudes mutantes `POST`, `PATCH` y `DELETE` de la API pasan por una cola
global cuando el repositorio MySQL está activo. Antes de cada mutación se crea
un snapshot `previous` desacoplado. Al terminar el handler se crea un snapshot
`next`, también desacoplado, y se entrega al repositorio dentro de una
transacción.

El orden es:

1. capturar `previous`;
2. ejecutar la mutación coordinada;
3. capturar `next`;
4. confirmar `next` en MySQL;
5. liberar la respuesta HTTP.

Si MySQL rechaza la operación, el servidor restaura `previous`, devuelve HTTP
503 y la cola continúa disponible para la siguiente solicitud. Esto evita que
el rollback de una solicitud revierta cambios confirmados por otra.

Las lecturas GET permanecen fuera de la cola. Por ello pueden observar durante
una ventana breve el estado provisional de una mutación todavía no confirmada.
Este riesgo está documentado y no bloquea la entrega.

## Dominio final de Reportes

`servidor/dominio/reportes.js` contiene:

- `buildReportSnapshot()`: conserva el payload estadístico y agrega identidad,
  fecha, autor y estado inicial;
- `reportStatus()`: normaliza `active`/`archived`;
- `reportMetadata()`: proyecta metadatos públicos;
- `validateReportTransition()`: valida archivado y restauración;
- `archiveReport()`: aplica archivado;
- `restoreReport()`: aplica restauración;
- `removeReport()`: elimina por identidad y devuelve el recibo de eliminación;
- `pruneOldestArchivedReports()`: ejecuta el preflight y la retención segura de
  archivados, del más antiguo al más nuevo.

Reportes consume `statisticsPayload()`; no duplica las fórmulas ni implementa
Estadísticas. El flujo es:

`statisticsPayload()` → `buildReportSnapshot()` → colección de reportes →
persistencia → detalle/PDF.

El PDF recibe el snapshot persistido y no recalcula estadísticas. Por eso un
reporte conserva su fotografía histórica aunque después cambie la asistencia.

## Acceso y recuperación administrativa

Las contraseñas se almacenan mediante `scrypt` y salts. Las sesiones usan
tokens aleatorios en cookies `HttpOnly` y `SameSite=Lax`. Los códigos OTP se
protegen con HMAC, expiración y límite de intentos.

La recuperación administrativa principal se realiza dentro de la aplicación:
se solicita un OTP por correo, se valida el código, se establece una contraseña
nueva y se invalidan las sesiones anteriores. `npm run reset:admin` se conserva
como herramienta local de contingencia, no como flujo principal.

## Correo y notificaciones

El correo admite Gmail o Resend, serializa entregas, reintenta fallos temporales
y conserva un historial sin códigos sensibles. El entorno actual usa Resend en
modo de prueba; para enviar a destinatarios arbitrarios se requiere un dominio
verificado o Gmail.

Las notificaciones de la aplicación se calculan desde el estado real: casos
académicos, usuarios inactivos, fallos de correo, fichas sin instructor y
jornadas pendientes.

## Estado técnico

- funcionalidad principal: completa;
- arquitectura: apta para entrega;
- MySQL: operacional;
- QR físico: aprobado;
- Reportes y Bloque 51: cerrados;
- pruebas automatizadas: verdes;
- defectos bloqueantes: ninguno;
- etapa actual: cierre documental, sustentación y posterior empaquetado final.

## Riesgos residuales aceptados

1. En modo legacy, si `persistReports()` falla después de mutar memoria, el
   rollback local de `reports` no está garantizado. MySQL es la fuente
   operacional actual, por lo que este riesgo no bloquea la entrega.
2. Una lectura GET puede observar temporalmente estado provisional durante una
   mutación MySQL pendiente.
3. Resend está configurado en modo de prueba y no permite cualquier destinatario
   sin completar la configuración del proveedor.
4. Los respaldos excluyen secretos, pero contienen datos personales y requieren
   custodia, acceso restringido y tratamiento adecuado.

## Deuda técnica aceptada

- `servidor/servidor.js` continúa siendo grande y mantiene estado compartido;
- `statisticsPayload()` conserva alto acoplamiento de lectura;
- fichas, horarios y ambientes comparten parte del código cliente;
- las pruebas automáticas no sustituyen toda revisión visual posible.

Estos puntos son oportunidades de evolución posterior. No son funcionalidades
faltantes ni defectos que impidan la entrega actual.
