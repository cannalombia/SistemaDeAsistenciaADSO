BLUE MAGIC V5
HISTORIAL DE MEJORAS, COMMITS Y ESTADO DEL PROYECTO
Documento consolidado y ordenado cronológicamente

======================================================================
PROPÓSITO DEL DOCUMENTO
======================================================================

Este archivo registra la evolución real de Blue Magic V5 desde los
primeros puntos de mejora hasta el estado técnico actual.

Los bloques están organizados en orden cronológico, de arriba hacia
abajo, siguiendo la forma en que se ha venido trabajando el proyecto.

Cada bloque resume:
- objetivo;
- cambios realizados;
- validaciones ejecutadas;
- estado del commit;
- impacto sobre el sistema;
- siguiente paso.

IMPORTANTE:
Los porcentajes que aparecen durante el historial son estimaciones de
cada momento y deben leerse como estados históricos.

La valoración estricta de 89/100 corresponde a una revisión anterior,
realizada antes de cerrar MySQL, seguridad, Git, empaquetado y
documentación.

ESTADO MÁS RECIENTE:
funcionalmente completo dentro del alcance definido.

CIERRE TÉCNICO ACTUAL:
- prueba física QR/cámara con celular real: APROBADA;
- MySQL definitivo: APROBADO Y CERRADO;
- Git y GitHub: CONFIGURADOS;
- colaboración: CONFIGURADA;
- GitHub Actions: último run publicado en ROJO por dependencia accidental
  de dos pruebas respecto al .env local;
- corrección del fallo de CI: IMPLEMENTADA Y VALIDADA LOCALMENTE EN COPIA
  LIMPIA, todavía pendiente de commit/push según el último estado registrado;
- ZIP final: PENDIENTE hasta confirmar CI verde;
- tag final: PENDIENTE hasta aprobar el ZIP.

PENDIENTES PARA EL CIERRE DEFINITIVO:
- crear y publicar únicamente el commit de corrección de las dos pruebas;
- confirmar la nueva ejecución de GitHub Actions en verde;
- regenerar el ZIP final desde el último commit estable;
- verificar el contenido e integridad del ZIP;
- crear el tag final de versión sin publicarlo automáticamente.


======================================================================
1. PUNTO DE PARTIDA — AUDITORÍA INICIAL
======================================================================

ESTADO INICIAL APROXIMADO: 80/100

El proyecto ya tenía cubierto el flujo principal:
- acceso por roles;
- gestión de usuarios;
- correo;
- asistencia manual;
- QR;
- estadísticas;
- reportes PDF;
- importación y exportación SQL;
- pruebas automáticas funcionando.

Problemas principales detectados en esta etapa:

1. Fichas, horarios y ambientes dependían de localStorage.
2. El CRUD de formación todavía estaba incompleto.
3. El respaldo no cubría todo el sistema.
4. La persistencia principal seguía basada en CSV/JSON.
5. Faltaba auditoría administrativa completa.
6. Faltaba corrección controlada de asistencia.
7. La recuperación administrativa dependía de reset:admin.
8. Las notificaciones eran todavía informativas/ficticias.
9. Los informes guardados no tenían ciclo de vida completo.
10. Faltaban pruebas visuales reales en PC y móvil.

OBJETIVO GENERAL DEFINIDO:
Convertir Blue Magic de un sistema funcional local en una aplicación
persistente, auditable, recuperable y sostenible.


======================================================================
2. COMMIT — PERSISTENCIA CENTRAL DE FORMACIÓN
======================================================================

OBJETIVO:
Eliminar la dependencia de localStorage para fichas, horarios y
ambientes.

CAMBIOS REALIZADOS:
- Fichas, horarios y ambientes pasan a una fuente central persistente.
- Se crea y utiliza datos/formacion.json como fuente compartida.
- Las pantallas dejan de trabajar con datos aislados del navegador.
- Se crean rutas de servidor para formación.
- Las pantallas consultan y modifican la información desde el backend.
- Se mantienen los datos disponibles después de reiniciar el servidor.

VALIDACIONES:
- Persistencia después del reinicio.
- Integración con asistencia.
- Integración con estadísticas.
- Compatibilidad con flujos anteriores.

RESULTADO:
APROBADO.

IMPACTO:
Se elimina uno de los principales riesgos funcionales: que dos equipos
vean información diferente por depender de localStorage.


======================================================================
3. COMMIT — CRUD COMPLETO DE FORMACIÓN
======================================================================

OBJETIVO:
Completar Programas, Fichas, Horarios y Ambientes.

CAMBIOS REALIZADOS:
- Crear.
- Consultar.
- Editar.
- Activar.
- Desactivar.
- Eliminar con confirmación.
- Validar dependencias antes de eliminar.
- Registrar cambios en auditoría.

PROTECCIONES IMPLEMENTADAS:
- Un programa con fichas vinculadas no se elimina.
- Una ficha con aprendices, horarios o asistencias no se elimina.
- Un ambiente con horarios no se elimina.
- Un horario con asistencias relacionadas no se elimina.
- No se realizan eliminaciones en cascada.
- El usuario recibe información sobre las dependencias existentes.
- Se recomienda desactivar cuando no es seguro eliminar.

ESTADOS:
Horarios y ambientes pueden permanecer Activos o Inactivos.
Los elementos inactivos dejan de participar en sesiones futuras y
alertas operativas, pero conservan su historial.

RESULTADO:
APROBADO.


======================================================================
4. COMMIT — AUDITORÍA DE ACCIONES
======================================================================

OBJETIVO:
Registrar quién modifica el sistema y qué cambió.

CAMBIOS REALIZADOS:
Se implementó una bitácora persistente con:
- actor;
- fecha;
- entidad;
- acción;
- valor anterior;
- valor nuevo.

ACCIONES AUDITADAS:
- creación de usuarios;
- modificación de usuarios;
- activación/desactivación;
- importación;
- cambios de formación;
- asistencia manual;
- registros QR;
- operaciones administrativas sensibles.

ACCESO:
La auditoría puede consultarse desde:
Configuración → Auditoría → Ver actividad.

RETENCIÓN:
El historial conserva hasta 5000 acciones.

PERMISOS:
Solo Administrador y Coordinador pueden consultar la auditoría.

RESULTADO:
APROBADO.


======================================================================
5. COMMIT — NOTIFICACIONES REALES
======================================================================

OBJETIVO:
Reemplazar el mensaje estático de notificaciones por alertas reales.

CAMBIOS REALIZADOS:
La campana consulta alertas del servidor y se actualiza periódicamente.

CASOS MOSTRADOS:
- casos académicos;
- usuarios inactivos;
- errores de correo;
- fichas sin instructor;
- jornadas pendientes;
- situaciones operativas relevantes.

RESULTADO:
APROBADO.


======================================================================
6. ESTADO DE LOS 10 PUNTOS ORIGINALES
======================================================================

COMPLETADOS EN ESTA ETAPA:
[OK] 1. Formación centralizada.
[OK] 2. CRUD completo.
[OK] 5. Auditoría.
[OK] 8. Notificaciones reales.

PENDIENTES EN ESE MOMENTO:
[ ] 3. Respaldo/restauración integral.
[ ] 4. Base de datos transaccional.
[ ] 6. Corrección controlada de asistencia.
[ ] 7. Recuperación administrativa.
[ ] 9. Administración de reportes.
[ ] 10. Pruebas visuales y de uso real.

VALORACIÓN REGISTRADA:
87/100.


======================================================================
7. COMMIT — ESCALABILIDAD DE FORMACIÓN
FECHA: 30/09/2026
======================================================================

OBJETIVO:
Ajustar el proyecto al escenario operativo definido para Blue Magic.

ESCALA OBJETIVO:
- 240 aprendices.
- 8 fichas.
- 11 instructores.
- Hasta 300 usuarios soportados.
- Lunes a viernes.
- Dos jornadas.

JORNADAS:
- Mañana: 07:00 a 13:00.
- Tarde: 13:00 a 19:00.

DISTRIBUCIÓN:
- Cuatro fichas en jornada de mañana.
- Cuatro fichas en jornada de tarde.
- Aproximadamente 30 aprendices por ficha.

REGLA DE INSTRUCTORES:
Un instructor puede trabajar con distintas fichas durante la semana,
siempre que no tenga dos asignaciones en el mismo horario.

También puede:
- trabajar con diferentes fichas;
- dictar clases consecutivas;
- rotar durante la semana.

El sistema bloquea:
- horarios superpuestos;
- asignaciones incompatibles.

ARCHIVOS DESTACADOS:
- servidor/configuracion/escala_formacion.js
- servidor/servidor.js
- aplicacion/recursos/JS scripts/aplicacion.js
- documentación de escala.

VALIDACIONES:
- 300 usuarios.
- 240 aprendices.
- 11 instructores.
- 8 fichas.
- 40 franjas semanales.
- Rotación sin cruces.
- npm test aprobado.

RESULTADO:
APROBADO.

VALORACIÓN REGISTRADA DESPUÉS DEL CAMBIO:
aprox. 90/100.


======================================================================
8. COMMIT — RESPALDO Y RESTAURACIÓN ATÓMICA
======================================================================

OBJETIVO:
Convertir el respaldo/restauración en una función real de recuperación.

CAMBIOS REALIZADOS:
- El respaldo deja de incluir secretos.
- No guarda contraseñas.
- No guarda hashes.
- No guarda salts.
- No guarda tokens.
- No guarda configuración sensible.
- Se genera un archivo de seguridad previo a cada restauración.
- La restauración prepara todos los archivos antes de reemplazarlos.
- Los archivos se reemplazan como una sola operación lógica.
- Si una parte falla, se revierten los archivos ya modificados.
- Solo el Administrador puede ejecutar estas operaciones.

ARCHIVO PREVIO:
Pre_restauracion_...json

VALIDACIONES:
- pruebas específicas;
- rollback;
- control de permisos;
- suite completa;
- sintaxis;
- reinicio del servidor.

RESULTADO:
APROBADO.

ESTADO DE LOS 10 PUNTOS:
[OK] 1. Formación centralizada.
[OK] 2. CRUD completo.
[OK] 3. Respaldo/restauración integral.
[ ] 4. MySQL.
[OK] 5. Auditoría.
[ ] 6. Corrección controlada.
[ ] 7. Recuperación administrativa.
[OK] 8. Notificaciones.
[ ] 9. Administración de reportes.
[ ] 10. Prueba real final.


======================================================================
9. REVISIÓN INTERMEDIA DEL PROYECTO
======================================================================

VALORACIÓN REGISTRADA:
aprox. 92/100.

PENDIENTES PRINCIPALES EN ESE MOMENTO:
1. Corrección controlada de asistencia.
2. Recuperación administrativa.
3. Administración de reportes.
4. MySQL como almacenamiento principal.
5. Prueba final real en PC y móvil.
6. Módulo de excusas.
7. Limpieza de datos y documentación.
8. Paquete final sin secretos.

ESTRUCTURA FUNCIONAL ALCANZADA:

BLUE MAGIC V5
|
+-- Inicio de sesión
|   +-- Administrador
|   +-- Coordinador
|   +-- Instructor
|   +-- Aprendiz
|
+-- Gestión de usuarios
|   +-- Crear
|   +-- Editar
|   +-- Desactivar
|   +-- Importar usuarios
|
+-- Formación
|   +-- Programas
|   +-- Fichas
|   +-- Horarios
|   +-- Ambientes
|
+-- Asistencia
|   +-- Manual
|   +-- QR
|
+-- Estadísticas
+-- Reportes PDF
+-- Auditoría
+-- Notificaciones
+-- Respaldo y Restauración
+-- Escalabilidad


======================================================================
10. PLAN DE CIERRE DEFINIDO PARA BLUE MAGIC V5
======================================================================

1. CORRECCIÓN CONTROLADA DE ASISTENCIA
- corregir Presente/Ausente;
- exigir motivo;
- guardar valor anterior y nuevo;
- registrar responsable;
- registrar fecha;
- bloquear/cerrar jornada;
- permitir reapertura autorizada.

2. RECUPERACIÓN DEL ADMINISTRADOR
- recuperación desde la aplicación;
- OTP por correo;
- expiración;
- límite de intentos;
- auditoría.

3. ADMINISTRACIÓN DE REPORTES
- consultar;
- descargar;
- archivar;
- eliminar con confirmación;
- permisos;
- auditoría;
- retención.

4. MÓDULO DE EXCUSAS
- aprendiz adjunta soporte;
- instructor revisa;
- aprobar/rechazar;
- ausencia pasa a Justificada cuando corresponda.

5. MYSQL COMO BASE PRINCIPAL
- usuarios;
- formación;
- asistencia;
- reportes;
- auditoría;
- migración sin pérdida de datos.

6. VALIDACIÓN REAL
- Administrador;
- Coordinador;
- Instructor;
- Aprendiz;
- PC;
- móvil;
- QR.

7. CIERRE Y ENTREGA
- limpiar datos;
- actualizar documentación;
- retirar secretos;
- revisar consola;
- revisar servidor;
- npm test final.


======================================================================
11. COMMIT — INFRAESTRUCTURA MYSQL
FECHA: 30/09/2026 — 23:18 aprox.
======================================================================

OBJETIVO:
Preparar MySQL como fuente de datos definitiva sin realizar un corte
inseguro.

CAMBIOS REALIZADOS:
- mysql2 incorporado.
- Migraciones versionadas up/down.
- UTF8MB4.
- Índices.
- Claves foráneas.
- ON DELETE RESTRICT.
- Repositorio MySQL transaccional.
- Usuarios.
- Asistencia.
- Formación.
- Reportes.
- Auditoría.
- Comparación automática de datos.
- Respaldo/restauración conectado al estado MySQL.
- Rollback con respaldo automático previo.
- Usuario de aplicación separado del usuario migrador.
- Uso de root rechazado.
- Health check MySQL.
- Validación de variables.
- Arranque fail-fast.
- Cierre limpio del pool.
- Base de pruebas independiente mediante DB_NAME_TEST.
- mysql2 añadido.
- Nodemailer actualizado.
- npm audit: 0 vulnerabilidades.

ARCHIVOS CLAVE:
- base_datos/migraciones/001_esquema_aplicacion.up.sql
- base_datos/migraciones/001_esquema_aplicacion.down.sql
- servidor/base_datos/conexion.js
- servidor/base_datos/configuracion.js
- servidor/base_datos/migraciones.js
- servidor/base_datos/repositorio.js
- servidor/base_datos/legado.js
- base_datos/crear_usuario_aplicacion.sql.example
- documentacion/guias/cierre_tecnico_mysql.md
- .env.example

VALIDACIÓN:
- suite completa aprobada;
- health check en modo legacy aprobado;
- npm audit con 0 vulnerabilidades.

BLOQUEO DETECTADO EN ESE MOMENTO:
14 aprendices apuntaban a la ficha histórica 3349881, que no aparecía
en formacion.json.

DECISIÓN:
No activar MySQL hasta corregir o restaurar esa relación.

RESULTADO:
INFRAESTRUCTURA APROBADA.
ACTIVACIÓN MYSQL: PENDIENTE.


======================================================================
12. COMMIT — CORRECCIÓN DE FICHA HISTÓRICA 3349881
======================================================================

ANÁLISIS:
La ficha 3349881 no era un dato inválido: era una ficha histórica que
debía conservarse.

CAMBIOS:
- Se restauró la ficha 3349881 en formación.
- No se movieron aprendices.
- No se alteraron asistencias.
- Se conservaron los 14 aprendices relacionados.

VALIDACIÓN:
- 0 relaciones rotas.

RESULTADO:
APROBADO.


======================================================================
13. COMMIT — CORRECCIÓN CONTROLADA DE ASISTENCIA
======================================================================

OBJETIVO:
Cerrar el punto pendiente de modificación segura de asistencia.

CAMBIOS REALIZADOS:
- corrección de asistencia existente;
- motivo de corrección;
- valor anterior;
- valor nuevo;
- actor responsable;
- auditoría;
- cierre de jornada;
- reapertura controlada;
- protección de jornadas cerradas.

FLUJO:

Asistencia registrada
        |
        v
Corrección autorizada
        |
        v
Motivo obligatorio
        |
        v
Auditoría antes/después
        |
        v
Cierre de jornada
        |
        v
Reapertura autorizada si se necesita

RESULTADO:
APROBADO.


======================================================================
14. COMMIT — MÓDULO DE EXCUSAS
======================================================================

OBJETIVO:
Completar el flujo de justificación de ausencias.

ARCHIVOS DESTACADOS:
- base_datos/migraciones/002_excusas.up.sql
- base_datos/migraciones/002_excusas.down.sql
- datos/ejemplos/excusas.ejemplo.json
- servidor/modulos/excusas.js
- servidor/rutas/formacion.js
- aplicacion/paginas HTML/asistencia.html
- aplicacion/paginas HTML/aprendiz.html
- aplicacion/recursos/JS scripts/asistencia.js
- aplicacion/recursos/JS scripts/aplicacion.js
- pruebas/prueba_cierre_asistencia.js
- pruebas/prueba_formacion_auditoria.js
- pruebas/prueba_reportes.js
- pruebas/servidor_visual.js

RESUMEN DEL COMMIT:
21 archivos modificados.
+512 líneas.
-51 líneas.

FLUJO IMPLEMENTADO:

Ausencia
   |
   v
Aprendiz presenta excusa
   |
   v
Se registra
   |
   v
Instructor/Administrador revisa
   |
   +--> Rechazada
   |
   +--> Aprobada
          |
          v
     Asistencia justificada

INTEGRACIÓN:
- asistencia;
- cierre/reapertura;
- auditoría;
- MySQL;
- aprendiz;
- instructor.

RESULTADO:
APROBADO.


======================================================================
15. CIERRE TÉCNICO BLUE MAGIC V5
FECHA: 01/10/2026 — 07:24
======================================================================

ESTADO DE INFRAESTRUCTURA MYSQL:
[OK] mysql2.
[OK] migraciones up/down.
[OK] repositorio transaccional.
[OK] índices y FK.
[OK] health check.
[OK] fail-fast.
[OK] rollback con respaldo previo.
[OK] usuario migrador separado.
[OK] usuario de aplicación separado.
[OK] base de pruebas independiente.
[OK] npm audit: 0 vulnerabilidades.

OTROS BLOQUES CERRADOS:
[OK] Respaldo/restauración integrado.
[OK] Suite automática completa.
[OK] Ficha histórica 3349881 conservada.
[OK] 14 aprendices conservados.
[OK] 0 relaciones rotas.
[OK] Corrección controlada de asistencia.
[OK] Cierre/reapertura de jornada.
[OK] Módulo de excusas.
[OK] Backend E2E.

FLUJO VALIDADO:

Ausencia
   ↓
Corrección auditada
   ↓
Cierre / Reapertura
   ↓
Excusa
   ↓
Aprobación
   ↓
Asistencia Justificada

ESTADO MYSQL EN ESE MOMENTO:
Preparado, pero todavía no activado como fuente definitiva.

DATA_SOURCE=legacy

MOTIVO:
Mantener un punto seguro de retorno hasta completar:
- migración;
- comparación;
- cutover;
- activación;
- validación final.


======================================================================
16. COMMIT — PRUEBAS VISUALES REALES
FECHA: 01/10/2026 — 07:32
======================================================================

OBJETIVO:
Validar la aplicación desde el navegador como usuario real.

ADMINISTRADOR:
- escritorio;
- navegación;
- usuarios;
- formación;
- asistencia;
- reportes;
- auditoría;
- permisos.

INSTRUCTOR:
- escritorio;
- fichas;
- asistencia;
- cierre/reapertura;
- excusas;
- QR;
- navegación.

APRENDIZ:
- simulación móvil 390x844;
- login;
- mi asistencia;
- mi programa;
- excusas;
- navegación.

VALIDACIONES:
[OK] Formularios.
[OK] Permisos.
[OK] Bloqueo de rutas por rol.
[OK] QR generado.
[OK] Asistencia guardada.
[OK] Consola sin errores críticos.
[OK] Sin desbordamiento horizontal.
[OK] npm test.
[OK] npm audit.
[OK] reinicio.
[OK] health check.
[OK] 0 relaciones rotas.
[OK] ficha 3349881 con 14 aprendices.

PENDIENTE:
- cámara/QR en celular físico;
- corte definitivo MySQL;
- validación final funcionando sobre MySQL.

VALORACIÓN HISTÓRICA REGISTRADA EN ESE MOMENTO:
aprox. 98-99/100.

NOTA:
Ese porcentaje era una valoración funcional previa al análisis de
sostenibilidad, Git, secretos y empaquetado.


======================================================================
17. INSTALACIÓN REAL DE MYSQL 8.4 LTS
FECHA: 01/10/2026
======================================================================

CAMBIOS REALIZADOS:
- MySQL Community Server 8.4 LTS instalado.
- Servicio automático de Windows.
- Servicio limitado a 127.0.0.1.
- UTF8MB4.
- Base real.
- Base de pruebas.
- Cuenta de aplicación separada.
- Cuenta de migración separada.

ESTRATEGIA DE SEGURIDAD:
MySQL se instala y prepara, pero Blue Magic permanece temporalmente en:

DATA_SOURCE=legacy

hasta terminar:
1. migraciones;
2. comparación;
3. pruebas transaccionales;
4. corte;
5. activación;
6. validación post-corte.

RESULTADO:
INSTALACIÓN APROBADA.
CORTE DEFINITIVO: PENDIENTE.


======================================================================
18. ÚLTIMA REVISIÓN REAL DE LA VERSIÓN 5
FECHA: 01/10/2026
======================================================================

Esta revisión se realizó sobre el ZIP real de la última versión,
no únicamente sobre reportes anteriores.

RESULTADO GENERAL VERIFICADO:
89/100.

DESGLOSE:

Funcionalidad general                  95/100
Administrador / Instructor / Aprendiz  95/100
Asistencia                             96/100
QR                                     93/100
Excusas                                92/100
Reportes / PDF / estadísticas          93/100
Formación / fichas / horarios          94/100
Pruebas automáticas                    95/100
MySQL                                  84/100
Seguridad del código                   87/100
Arquitectura                           86/100
Documentación                          84/100
Git / versionado                       76/100
Empaquetado / privacidad               70/100

VALORACIONES GENERALES:
Funcionalidad:              93/100
Sostenibilidad técnica:     85/100
Preparación para producción:82/100
NOTA GLOBAL:                89/100


======================================================================
19. RESULTADOS VERIFICADOS EN LA ÚLTIMA VERSIÓN
======================================================================

PRUEBAS:
npm test
RESULTADO: APROBADO.

LA SUITE COMPRUEBA:
- CRUD de usuarios;
- roles;
- permisos;
- administrador;
- instructor;
- aprendiz;
- QR;
- tokens vencidos;
- concurrencia/duplicados;
- asistencia;
- cierre;
- reapertura;
- excusas;
- aprobación;
- justificación;
- auditoría;
- reportes;
- PDF;
- respaldos;
- rollback;
- formación;
- horarios;
- ambientes;
- importación;
- escala.

SINTAXIS:
JavaScript revisado.
RESULTADO:
ALL_JS_SYNTAX_OK

SERVIDOR:
Arranque correcto.

HEALTH CHECK:
/api/health

ESTADO ACTUAL VERIFICADO:
database.source = legacy

Esto confirma que MySQL está preparado, pero no es todavía la fuente
definitiva de ejecución de la versión evaluada.


======================================================================
20. PENDIENTES TÉCNICOS REALES
======================================================================

PRIORIDAD 1 — SEGURIDAD DEL PAQUETE
El ZIP revisado contiene archivos que no deberían viajar en una
entrega pública o compartible:
- .env;
- configuración privada;
- datos operativos;
- credenciales;
- historiales;
- CSV reales;
- otros archivos sensibles.

ACCIÓN:
- crear paquete limpio;
- usar .env.example;
- excluir secretos;
- excluir información privada;
- rotar claves expuestas en paquetes compartidos.

PRIORIDAD 2 — GIT
El repositorio interpreta varios cambios de estructura como:
- archivos antiguos eliminados;
- carpetas nuevas no versionadas.

ACCIÓN:
- revisar git status;
- registrar renombres;
- eliminar correctamente rutas antiguas;
- agregar las nuevas;
- verificar .gitignore;
- hacer commit estable;
- crear tag final.

SUGERENCIA DE TAG:
v5.0.0-mysql

PRIORIDAD 3 — MYSQL DEFINITIVO
Ejecutar:

npm run db:migrate
npm run db:validate
npm run db:cutover
npm run db:activate

Después:

DATA_SOURCE=mysql

Reiniciar y verificar:

/api/health

Debe responder:
database.source = mysql
ready = true

PRIORIDAD 4 — VALIDACIÓN POST-MYSQL
Repetir:
- login;
- roles;
- usuarios;
- formación;
- asistencia;
- QR;
- excusas;
- auditoría;
- reportes;
- respaldo/restauración;
- reinicio;
- npm test.

PRIORIDAD 5 — QR FÍSICO
Probar:
- cámara real;
- celular físico;
- token;
- expiración;
- ficha;
- confirmación;
- asistencia registrada.


======================================================================
21. MEJORA DE ARQUITECTURA RECOMENDADA
======================================================================

servidor/servidor.js sigue concentrando demasiada lógica.

La arquitectura ya mejoró con:
- dominio;
- rutas;
- base_datos;
- modulos;
- migraciones;
- pruebas.

Pero el siguiente paso sostenible sería extraer controladores:

servidor/
|
+-- controladores/
|   +-- acceso.js
|   +-- asistencia.js
|   +-- excusas.js
|   +-- reportes.js
|   +-- administrador.js
|   +-- aprendiz.js
|
+-- rutas/
+-- modulos/
+-- dominio/
+-- base_datos/
+-- servidor.js

OBJETIVO:
Que servidor.js sea principalmente:
- configuración;
- dependencias;
- registro de rutas;
- servidor HTTP;
- inicio y cierre.


======================================================================
22. MEJORA FUTURA DE PERSISTENCIA MYSQL
======================================================================

La capa actual es funcional para el volumen del proyecto.

Sin embargo, a futuro conviene que las operaciones MySQL evolucionen
hacia cambios específicos por entidad.

Ejemplo recomendado:

Crear usuario
→ INSERT usuario

Editar asistencia
→ UPDATE asistencia

Crear excusa
→ INSERT excusa

Aprobar excusa
→ UPDATE excusa

Esto es más escalable que reconstruir grandes bloques del estado cuando
la aplicación crezca o tenga más usuarios concurrentes.


======================================================================
23. DOCUMENTACIÓN
======================================================================

La documentación debe representar la estructura real actual.

Revisar especialmente rutas antiguas como:
- aplicacion/paginas/
- aplicacion/recursos/scripts/
- aplicacion/recursos/estilos/

frente a las rutas vigentes:
- aplicacion/paginas HTML/
- aplicacion/recursos/JS scripts/
- aplicacion/recursos/estilos CCS/

OBJETIVO:
Evitar que un desarrollador nuevo siga instrucciones antiguas.


======================================================================
24. EVOLUCIÓN DEL PROYECTO
======================================================================

VERSIÓN 1
████░░░░░░░░░░░░░░░░
Proyecto visual.

VERSIÓN 2
████████░░░░░░░░░░░░
Interfaz + lógica.

VERSIÓN 3
████████████░░░░░░░░
Roles + asistencia.

VERSIÓN 4
████████████████░░░░
QR + reportes + persistencia.

VERSIÓN 5 ACTUAL
██████████████████░░
89/100 — evaluación técnica estricta de la versión real.

SIGUIENTE CIERRE
███████████████████░
95-97/100

META FINAL
████████████████████
100/100 dentro del alcance definido.


======================================================================
25. CAMINO ACTUAL DE 89 A 95-97
======================================================================

1. Rotar secretos.
2. Crear ZIP limpio.
3. Limpiar y estabilizar Git.
4. Ejecutar migraciones MySQL.
5. Ejecutar db:validate.
6. Ejecutar cutover.
7. Ejecutar activate.
8. Cambiar DATA_SOURCE=mysql.
9. Reiniciar.
10. Verificar /api/health.
11. Ejecutar npm test sobre MySQL.
12. Repetir flujos de Administrador.
13. Repetir flujos de Instructor.
14. Repetir flujos de Aprendiz.
15. Validar respaldo/restauración.
16. Probar QR con celular físico.
17. Actualizar documentación.
18. Crear commit y tag estables.


======================================================================
26. CONDICIÓN DE CIERRE AL 100%
======================================================================

Blue Magic V5 podrá considerarse 100/100 dentro del alcance definido
cuando se cumplan simultáneamente estas condiciones:

[ ] MySQL es la fuente definitiva.
[ ] Migraciones aprobadas.
[ ] Comparación legacy/MySQL aprobada.
[ ] 0 relaciones rotas.
[ ] npm test completo en verde sobre MySQL.
[ ] Permisos por rol correctos.
[ ] Asistencia funcionando.
[ ] Corrección y cierre funcionando.
[ ] Excusas funcionando.
[ ] Auditoría funcionando.
[ ] Reportes funcionando.
[ ] Respaldo/restauración funcionando.
[ ] Reinicio sin pérdida de información.
[ ] Health check correcto.
[ ] QR físico probado.
[ ] Consola sin errores críticos.
[ ] Git limpio.
[ ] Documentación actualizada.
[ ] Paquete final sin secretos.


======================================================================
27. ESTADO CONSOLIDADO DE LA REVISIÓN ESTRICTA PREVIA
======================================================================

PROYECTO:
Blue Magic V5

TIPO:
Sistema web de control de asistencia.

ESTADO:
Avanzado y funcional.

NOTA GLOBAL DE ESA REVISIÓN:
89/100.

FORTALEZAS:
- funcionalidad amplia;
- roles;
- permisos;
- asistencia;
- QR;
- excusas;
- auditoría;
- formación;
- reportes;
- respaldo;
- pruebas;
- escalabilidad definida;
- infraestructura MySQL preparada.

RIESGOS/PENDIENTES:
- activación definitiva de MySQL;
- empaquetado con secretos;
- limpieza de Git;
- documentación desactualizada en algunas rutas;
- concentración de lógica en servidor.js;
- prueba física QR/cámara.

CONCLUSIÓN:
Blue Magic ya no está en fase de prototipo. La versión actual es un
sistema funcional con una base técnica considerable.

El trabajo restante no consiste principalmente en agregar más
funciones, sino en cerrar correctamente ingeniería de producción:
persistencia definitiva, seguridad, versionado, empaquetado,
mantenibilidad y validación final.

La prioridad debe ser terminar estos puntos antes de añadir nuevas
funcionalidades.

======================================================================
FIN DEL HISTORIAL CONSOLIDADO — BLUE MAGIC V5
======================================================================
Correcto. Ya tienes evidencia real de que:

- MySQL está activo como fuente de datos.
- /api/health confirma source=mysql y ready=true.
- La API autenticada respondió HTTP 200.
- La aplicación leyó 2 programas desde MySQL.
- No fue necesario modificar datos legacy.

SIGUIENTE PASO ÚNICO:

1. Hacer el segundo reinicio controlado.
2. Confirmar nuevamente:
   - database.source = mysql
   - database.ready = true
   - los 2 programas siguen disponibles
3. Si todo persiste correctamente:
   - ejecutar npm test UNA sola vez.

Si npm test queda en verde, la activación MySQL puede considerarse técnicamente cerrada.

No repitas pruebas visuales ni flujos ya aprobados.
No borres CSV/JSON todavía.
Si aparece un fallo nuevo, detente únicamente en ese punto.

======================================================================
28. COMMIT — CORTE Y ACTIVACIÓN DEFINITIVA MYSQL
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Convertir MySQL en la fuente operacional definitiva de Blue Magic V5
sin pérdida de información y conservando el legado como respaldo.

ESTADO PREVIO:
- MySQL Community Server 8.4 LTS instalado.
- Migraciones disponibles.
- DATA_SOURCE=legacy.
- CSV/JSON seguían siendo la persistencia operacional.
- 0 relaciones rotas.

MIGRACIONES:
RESULTADO:
APROBADO.

PRIMER db:validate:
RESULTADO:
FALLO CONTROLADO.

MOTIVO:
MySQL todavía estaba vacío frente a los datos del legado.

DATOS DETECTADOS EN LEGACY:
- 55 usuarios.
- 50 aprendices.
- 11.986 asistencias.
- 2 programas.
- 9 fichas.
- 6 horarios.
- 5 ambientes.
- 6 reportes.
- 0 relaciones rotas.
- Ficha histórica 3349881 con 14 aprendices.

VERIFICACIÓN PREVIA DEL CORTE:
Se comprobó que db:cutover:
- ejecuta saveSnapshot(legacy);
- carga el estado legado en MySQL;
- no ejecuta activate automáticamente;
- no modifica ni elimina CSV/JSON;
- usa una transacción;
- ejecuta commit cuando finaliza correctamente;
- ejecuta rollback si ocurre un error.

CONTROL DE INTEGRIDAD:
Se tomaron huellas de los archivos CSV/JSON operacionales antes del
corte para comprobar después que permanecieran intactos.

db:cutover:
RESULTADO:
APROBADO.

VALIDACIÓN POST-CORTE:
db:validate
RESULTADO:
APROBADO.

COMPARACIÓN LEGACY / MYSQL:
- 55 usuarios: OK.
- 50 aprendices: OK.
- 11.986 asistencias: OK.
- 2 programas: OK.
- 9 fichas: OK.
- 6 horarios: OK.
- 5 ambientes: OK.
- 6 reportes: OK.
- relaciones rotas: 0.
- ficha 3349881: OK.
- 14 aprendices vinculados a 3349881: OK.
- diferencias de contenido: 0.

ACTIVACIÓN:
db:activate
RESULTADO:
APROBADO.

CONFIGURACIÓN FINAL:
DATA_SOURCE=mysql

PRUEBAS POST-ACTIVACIÓN:
- /api/health:
  database.source=mysql
  database.ready=true
- lectura autenticada por API: HTTP 200.
- lectura mínima de 2 programas desde MySQL: OK.
- primer reinicio controlado: OK.
- segundo reinicio controlado: OK.
- datos conservados después del reinicio: OK.
- npm test ejecutado una sola vez después del corte: APROBADO.

PERSISTENCIA FINAL:
MySQL queda como fuente operacional definitiva.

CSV/JSON:
- ya no son persistencia operacional;
- permanecen intactos como legado/respaldo;
- no fueron eliminados.

ERRORES:
Ninguno.

RESULTADO:
APROBADO Y CERRADO.


======================================================================
29. COMMIT — AUDITORÍA GIT Y RETIRO DE CREDENCIALES FIJAS
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Dejar Git consistente y retirar material sensible de autenticación del
código fuente antes de crear un commit estable.

AUDITORÍA DE GIT:
Se identificaron:
1. cambios legítimos de código;
2. traslados y renombres de páginas/recursos;
3. archivos locales u operativos que no debían versionarse.

ARCHIVOS LOCALES EXCLUIDOS:
- .env;
- configuraciones locales;
- logs;
- backups;
- datos operativos;
- dumps SQL operativos;
- JSON/CSV operativos;
- informes generados;
- archivos temporales;
- archivos personales de trabajo.

VALIDACIONES:
- git status revisado.
- git diff --stat revisado.
- git diff --name-status revisado.
- git diff --check: OK.
- Git reconoció los traslados principales como renombres.

HALLAZGO DE SEGURIDAD:
servidor/servidor.js contenía valores fijos de autenticación:
- salt;
- passwordHash.

CUENTAS AFECTADAS:
- Administrador SENA.
- Instructor SENA.

DECISIÓN:
Se bloqueó el staging y el commit hasta retirar ese material del código.

ANÁLISIS DE MYSQL:
MySQL conserva los perfiles operativos, pero no almacena campos:
- salt;
- passwordHash;
- contraseña;
- equivalentes de autenticación.

SOLUCIÓN:
- Administrador SENA:
  autenticación desde archivo local ignorado o variables de entorno.
- Instructor SENA:
  autenticación desde variables de entorno.
- Se eliminaron los valores hardcoded de servidor/servidor.js.
- .env.example conserva únicamente nombres/placeholders.
- .env permanece ignorado por Git.

PRUEBAS MÍNIMAS:
- login Administrador: OK.
- login Instructor: OK.
- hardcoded eliminado: SÍ.
- otros secretos actuales versionados: NO.
- git diff --check: OK.

HISTORIAL:
Se confirmó que los secretos antiguos sí existían en commits anteriores.

COMMIT ESTABLE:
Hash corto:
3f5e5b9

Mensaje:
security: retirar credenciales integradas del código y preparar configuración segura

ESTADO FINAL DEL COMMIT:
- .env incluido: NO.
- secretos actuales versionados: NO.
- branch: main.
- git status: limpio.

RESULTADO:
APROBADO.


======================================================================
30. CIERRE DE SEGURIDAD — ROTACIÓN DE CREDENCIALES HISTÓRICAS
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Invalidar las credenciales que habían quedado expuestas en el historial
de Git.

CUENTAS ROTADAS:
- Administrador SENA.
- Instructor SENA.

PROCEDIMIENTO:
- nuevas contraseñas generadas en memoria;
- nuevos salts y hashes;
- almacenamiento únicamente en configuración local ignorada;
- ningún valor sensible nuevo fue escrito en archivos versionados;
- no se reescribió el historial Git.

INCIDENCIA:
El primer intento no pudo escribir .env por permisos de Windows.
El archivo administrativo sí alcanzó a cambiar.

ACCIÓN CORRECTIVA:
Se repitió la rotación completa como una sola operación controlada para
que ambas cuentas quedaran sincronizadas.

PRUEBAS:
- Administrador rotado: SÍ.
- Instructor rotado: SÍ.
- credenciales antiguas invalidadas: SÍ.
- login administrador con nueva credencial: OK.
- login instructor con nueva credencial: OK.
- secretos actuales versionados: NO.
- .env ignorado: SÍ.
- git status: limpio (main).
- errores: ninguno.

RESULTADO:
APROBADO.


======================================================================
31. PAQUETE LIMPIO — PRIMERA GENERACIÓN
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Crear una entrega reproducible y segura sin copiar archivos locales del
equipo.

ESTRATEGIA:
El paquete se generó desde el contenido exacto del commit estable, no
desde el directorio de trabajo.

EXCLUIDOS:
- .env;
- credenciales;
- datos operativos;
- logs;
- respaldos;
- dumps SQL operativos;
- archivos personales;
- metadatos de Git;
- configuración local del editor;
- temporales;
- node_modules.

INCLUIDOS:
- código fuente;
- package.json;
- package-lock.json;
- .env.example;
- migraciones;
- scripts;
- pruebas;
- documentación versionada.

PAQUETE CREADO:
BLUE_MAGIC_V5_PAQUETE_LIMPIO_2026-10-01.zip

TAMAÑO APROXIMADO:
1,83 MB.

VALIDACIONES:
- paquete creado: SÍ.
- secretos incluidos: NO.
- .env incluido: NO.
- datos operativos incluidos: NO.
- archivos necesarios faltantes: NO.
- errores: ninguno.

RESULTADO:
APROBADO.

NOTA:
Este paquete fue creado antes del commit documental f84ea38.
Debe regenerarse una sola vez al final para incluir la documentación más
reciente.


======================================================================
32. COMMIT — DOCUMENTACIÓN FINAL MYSQL, SEGURIDAD Y RUTAS
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Actualizar la documentación para que represente el estado real actual
de Blue Magic V5.

REFERENCIAS OBSOLETAS DETECTADAS:
- CSV/JSON descritos como fuente activa.
- DATA_SOURCE=legacy.
- arquitectura indicando que no se necesitaba base de datos.
- rutas antiguas de páginas y recursos.
- referencias a credenciales integradas.

ARCHIVOS MODIFICADOS:
1. .env.example
2. Estructura.txt
3. README.md
4. datos/README.md
5. documentación de arquitectura actual
6. guía de cierre técnico MySQL
7. presentación del proyecto

ACTUALIZACIONES:
- MySQL documentado como persistencia operacional definitiva.
- DATA_SOURCE=mysql reflejado correctamente.
- migraciones documentadas como completadas.
- db:cutover documentado como completado.
- db:activate documentado como completado.
- CSV/JSON descritos como legado/respaldo.
- credenciales documentadas fuera del código.
- secretos documentados fuera del repositorio.
- paquete limpio documentado.
- estructura de carpetas actualizada.

RUTAS CORREGIDAS:
- aplicacion/paginas
  → aplicacion/paginas HTML

- aplicacion/recursos/scripts
  → aplicacion/recursos/JS scripts

- aplicacion/recursos/estilos
  → aplicacion/recursos/estilos CCS

VALIDACIONES:
- exactamente 7 archivos modificados.
- todos eran documentación o configuración de ejemplo.
- sin cambios funcionales.
- git diff --check: OK.
- errores: ninguno.

COMMIT:
Hash corto:
f84ea38

Mensaje:
docs: actualizar documentación final de Blue Magic V5 con MySQL

ESTADO FINAL:
- branch: main.
- git status: limpio.

RESULTADO:
APROBADO.


======================================================================
33. PREPARACIÓN DE PRUEBA QR FÍSICA
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Preparar la última prueba física pendiente sin simular el escaneo.

CONDICIONES:
- utilizar la aplicación real en Windows;
- mantener MySQL como persistencia activa;
- utilizar una sesión real de personal;
- generar QR desde la interfaz;
- duración del token QR: 60 segundos;
- escanear únicamente con celular físico;
- no simular cámara;
- no registrar asistencia manual para sustituir la prueba;
- no marcar la prueba como aprobada hasta confirmar el resultado físico.

FLUJO PREPARADO:

Servidor Blue Magic
        |
        v
MySQL activo
        |
        v
Sesión de personal
        |
        v
Pantalla de QR
        |
        v
Ficha / jornada
        |
        v
Generar QR de 60 segundos
        |
        v
DETENERSE
        |
        v
Escaneo con celular físico
        |
        v
Confirmación
        |
        v
Verificar asistencia registrada

ESTADO:
PREPARACIÓN EN CURSO.

PRUEBA FÍSICA:
PENDIENTE.


======================================================================
34. ESTADO ACTUAL PARA RETOMAR
FECHA: 01/10/2026
======================================================================

ESTADO GENERAL:
aprox. 99/100 dentro del alcance definido.

BLOQUES CERRADOS:
[OK] Formación centralizada.
[OK] CRUD de formación.
[OK] Auditoría.
[OK] Notificaciones reales.
[OK] Respaldo/restauración.
[OK] Escalabilidad.
[OK] Corrección controlada de asistencia.
[OK] Cierre/reapertura.
[OK] Módulo de excusas.
[OK] Pruebas visuales de Administrador.
[OK] Pruebas visuales de Instructor.
[OK] Aprendiz móvil 390x844.
[OK] QR generado desde interfaz.
[OK] Consola sin errores críticos.
[OK] MySQL Community Server 8.4 LTS.
[OK] Migraciones.
[OK] db:cutover.
[OK] db:validate.
[OK] 0 relaciones rotas.
[OK] ficha 3349881 conservada.
[OK] 14 aprendices de 3349881 conservados.
[OK] db:activate.
[OK] DATA_SOURCE=mysql.
[OK] health check MySQL.
[OK] lectura autenticada por API HTTP 200.
[OK] persistencia después de reinicio.
[OK] npm test post-MySQL.
[OK] CSV/JSON fuera de la persistencia operacional.
[OK] Git estabilizado.
[OK] credenciales retiradas del código.
[OK] credenciales históricas rotadas.
[OK] secretos actuales versionados: NO.
[OK] commit de seguridad 3f5e5b9.
[OK] paquete limpio inicial.
[OK] documentación final actualizada.
[OK] commit documental f84ea38.
[OK] git status limpio en main.

ÚNICOS PENDIENTES PARA EL CIERRE:

1. PRUEBA QR FÍSICA
   - iniciar sesión de personal;
   - abrir pantalla QR;
   - seleccionar ficha/jornada;
   - generar QR;
   - escanear con celular real;
   - validar token;
   - confirmar ficha;
   - registrar asistencia;
   - comprobar que la asistencia quedó guardada.

2. REGENERAR ZIP FINAL
   - usar como origen el commit f84ea38;
   - incluir documentación actualizada;
   - mantener exclusión de .env, secretos y datos operativos.

3. TAG FINAL
   - confirmar git status limpio;
   - crear tag sugerido:
     v5.0.0-mysql

NO REPETIR AL RETOMAR:
- migraciones MySQL;
- db:cutover;
- db:activate;
- npm test sin causa técnica;
- pruebas visuales ya aprobadas;
- pruebas de roles ya aprobadas;
- rotación de credenciales;
- nuevas funcionalidades;
- refactorizaciones no necesarias.

PUNTO EXACTO PARA CONTINUAR:
Abrir Blue Magic con MySQL activo, iniciar sesión de personal y dejar
lista la pantalla de QR para generar el token justo antes del escaneo
con el celular físico.

CONDICIÓN PARA 100/100:
- QR físico aprobado.
- ZIP final regenerado desde f84ea38.
- tag final creado.

======================================================================
35. PRUEBA FÍSICA QR — APROBADA
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Cerrar la única validación que dependía de hardware físico real.

PRUEBA REALIZADA:
- aplicación real ejecutándose en Windows;
- MySQL activo como persistencia operacional;
- QR generado desde la interfaz;
- escaneo realizado con celular físico;
- cámara y lectura del QR funcionando;
- flujo de validación completado;
- registro de asistencia confirmado.

RESULTADO:
APROBADO.

ESTADO:
La prueba física QR/cámara deja de ser un pendiente del proyecto.

NOTA:
El bloque 33 conserva el estado histórico anterior, cuando esta prueba
todavía estaba pendiente. Este bloque 35 registra su cierre real.


======================================================================
36. GITHUB DEFINITIVO Y COLABORACIÓN
FECHA: 01/10/2026
======================================================================

REPOSITORIO DEFINITIVO:
https://github.com/cannalombia/SistemaDeAsistenciaADSO

ESTADO:
- main sincronizada con origin/main en el último estado publicado;
- GitHub se utiliza como repositorio principal del proyecto;
- se configuró colaboración con Juan Manuel Ortiz;
- Juan trabaja mediante su propia identidad Git;
- rama de trabajo definida para Juan:
  juan-desarrollo;
- los cambios de colaboración deben integrarse a main mediante Pull
  Request cuando corresponda;
- no usar git push --force durante el flujo normal de colaboración.

ARCHIVO LOCAL NO VERSIONADO:
git_proceso_Sistema.md

REGLA:
- permanece sin seguimiento;
- no fue modificado durante el cierre de CI;
- no debe agregarse accidentalmente a commits;
- no debe incluirse en el ZIP final;
- no forma parte del tag.

RESULTADO:
APROBADO.


======================================================================
37. COMMIT — INTEGRACIÓN CONTINUA CON GITHUB ACTIONS
FECHA: 01/10/2026
======================================================================

HASH CORTO:
bcf72da

HASH COMPLETO:
bcf72dab96bbb2c6e4859974901ae60e055bba9a

MENSAJE:
ci: agregar pruebas automáticas con GitHub Actions

ARCHIVO:
.github/workflows/node.js.yml

OBJETIVO:
Agregar integración continua para validar automáticamente el proyecto
cuando se publican cambios en GitHub.

CONFIGURACIÓN:
- push a main;
- push a juan-desarrollo;
- pull requests dirigidos a main;
- ejecución manual mediante workflow_dispatch;
- entorno ubuntu-latest;
- Node.js 24.x;
- npm ci;
- npm test.

PRIMERA EJECUCIÓN REAL:

Run ID:
36933085636

Job ID:
110606892004

EVENTO:
push a main

ESTADO:
completed

RESULTADO:
failure

PASOS:
- checkout: APROBADO;
- configuración Node.js: APROBADO;
- npm ci: APROBADO;
- npm test: FALLÓ con código de salida 1.

IMPORTANTE:
El workflow sí se ejecutó correctamente. El fallo estaba dentro de la
suite de pruebas y no en la definición básica de GitHub Actions.

RESULTADO DEL COMMIT:
PUBLICADO.
CI INICIAL: ROJO.


======================================================================
38. DIAGNÓSTICO DEL FALLO DE CI
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Determinar la causa exacta del fallo de npm test sin modificar código o
infraestructura a ciegas.

ESTRATEGIA:
Se reprodujo el job de GitHub Actions en una copia temporal limpia del
commit bcf72da.

CONDICIONES DE LA COPIA LIMPIA:
- sin .env;
- sin cambios locales;
- instalación mediante npm ci;
- Node.js 24;
- ejecución de npm test;
- sin tocar datos operativos;
- sin repetir migraciones;
- sin modificar MySQL.

CAUSA EXACTA:
Dos pruebas dependían accidentalmente de credenciales presentes en el
.env local.

NO ERA UN PROBLEMA DE:
- MySQL;
- migraciones;
- datos;
- db:cutover;
- db:activate;
- workflow de GitHub Actions;
- código funcional de producción.

PRIMER FALLO:

ARCHIVO:
pruebas/prueba_proyecto.js

PRUEBA:
csvEmailLookupTest

PROBLEMA:
La prueba creaba el servidor sin proporcionar una contraseña
administrativa de prueba.

EFECTO:
createProjectServer rechazaba la inicialización por falta de credenciales
administrativas.

SEGUNDO FALLO:

ARCHIVO:
pruebas/prueba_reportes.js

PROBLEMA:
La prueba intentaba iniciar sesión como instructor utilizando
instructor123, pero el servidor de pruebas no recibía explícitamente
instructorPassword.

EFECTO:
La autenticación respondía HTTP 401.

CONCLUSIÓN:
La suite funcionaba localmente porque encontraba credenciales en la
configuración local. GitHub Actions ejecuta el proyecto en un entorno
limpio sin .env, por lo que las pruebas debían declarar explícitamente
sus propias credenciales aisladas.

RESULTADO:
CAUSA IDENTIFICADA.


======================================================================
39. CORRECCIÓN LOCAL — CREDENCIALES AISLADAS PARA PRUEBAS CI
FECHA: 01/10/2026
======================================================================

OBJETIVO:
Eliminar la dependencia accidental del .env local sin modificar la
autenticación de producción.

ARCHIVOS MODIFICADOS:
1. pruebas/prueba_proyecto.js
2. pruebas/prueba_reportes.js

CAMBIO 1:
En csvEmailLookupTest se añadió una credencial administrativa exclusiva
para el escenario de prueba:

adminPassword: "csv-email-test-password"

MOTIVO:
- permitir inicializar el servidor de prueba;
- no depender de ADMIN_AUTH_* del entorno local;
- mantener aislada la prueba.

CAMBIO 2:
En las opciones del servidor de pruebas de reportes se hizo explícita la
credencial utilizada por el propio test:

instructorPassword: "instructor123"

MOTIVO:
- permitir el login del instructor dentro de la prueba;
- evitar dependencia de credenciales locales;
- corregir el HTTP 401 reproducido en el entorno limpio.

ALCANCE:
- solo archivos de pruebas;
- autenticación de producción: SIN CAMBIOS;
- .env: SIN CAMBIOS;
- MySQL: SIN CAMBIOS;
- migraciones: SIN CAMBIOS;
- módulos funcionales: SIN CAMBIOS;
- datos operativos: SIN CAMBIOS.

RESUMEN DEL DIFF:
- 2 archivos modificados;
- 2 inserciones;
- 1 eliminación;
- git diff --check sin errores de espacios;
- advertencias de finales de línea CRLF/LF únicamente.

RESULTADO:
CORRECCIÓN IMPLEMENTADA LOCALMENTE.


======================================================================
40. VALIDACIÓN LIMPIA DEL AJUSTE DE CI
FECHA: 01/10/2026
======================================================================

ENTORNO:
Copia limpia del repositorio sin .env.

EJECUCIÓN:
npm ci

RESULTADO:
APROBADO.

DETALLE:
- 44 paquetes instalados;
- 0 vulnerabilidades reportadas.

EJECUCIÓN:
npm test

RESULTADO:
APROBADO.

CÓDIGO DE SALIDA:
0

SUITE:
COMPLETA Y APROBADA.

ESCENARIOS INCLUIDOS EN LA VALIDACIÓN:
- lógica y módulos;
- soporte y comparación MySQL;
- migraciones;
- corrección de asistencia;
- cierre y reapertura;
- excusas;
- aprobación de excusas;
- roles;
- autenticación;
- páginas;
- QR;
- reportes;
- PDF;
- CORS;
- URL pública;
- datos CSV de prueba;
- SQLFILE;
- respaldo/restauración;
- formación;
- auditoría;
- escala.

CONCLUSIÓN:
Las dos correcciones permiten ejecutar la suite en un entorno limpio sin
depender del .env local.

No es necesario repetir esta validación local sin una causa técnica
nueva.


======================================================================
41. COMMIT DE CORRECCIÓN CI — PENDIENTE DE CREACIÓN/PUBLICACIÓN
FECHA: 01/10/2026
======================================================================

ESTADO REGISTRADO AL CIERRE DE ESTA SESIÓN:
El commit todavía NO había sido creado ni publicado.

MENSAJE APROBADO:
test: aislar credenciales de prueba para CI

DEBE CONTENER ÚNICAMENTE:
- pruebas/prueba_proyecto.js
- pruebas/prueba_reportes.js

NO DEBE INCLUIR:
- git_proceso_Sistema.md;
- .env;
- secretos;
- credenciales reales;
- archivos locales;
- ningún otro cambio.

OBJETIVO:
Publicar únicamente el ajuste de pruebas ya validado en copia limpia y
permitir que GitHub Actions confirme el resultado.

SIGUIENTE VALIDACIÓN:
La nueva ejecución de GitHub Actions debe quedar asociada al hash nuevo
del commit y debe aprobar:
- npm ci;
- npm test.

CONDICIÓN:
No generar ZIP ni crear tag mientras CI continúe rojo o sin verificar.


======================================================================
42. ESTADO DEFINITIVO DE MYSQL — NO REPETIR
FECHA: 01/10/2026
======================================================================

ESTADO:
APROBADO Y CERRADO.

CONFIRMADO:
- MySQL Community Server 8.4 LTS operativo;
- base de producción separada;
- base de pruebas separada;
- usuario de aplicación separado;
- usuario migrador separado;
- permiso REFERENCES corregido;
- migraciones terminadas;
- db:cutover terminado;
- db:validate terminado;
- db:activate terminado;
- DATA_SOURCE=mysql;
- /api/health:
  source=mysql
  ready=true
- lectura autenticada por API: HTTP 200;
- persistencia comprobada después de reinicio;
- CSV/JSON fuera de la persistencia operacional;
- 0 relaciones rotas.

DATOS VALIDADOS:
- 55 usuarios;
- 50 aprendices;
- 11.986 asistencias;
- 2 programas;
- 9 fichas;
- 6 horarios;
- 5 ambientes;
- 6 reportes.

FICHA HISTÓRICA 3349881:
- conservada;
- 14 aprendices;
- historial conservado;
- no mover aprendices.

NO REPETIR:
- npm run db:migrate;
- npm run db:cutover;
- npm run db:activate;
- importación de datos;
- configuración MySQL;
- cambios de permisos sin error técnico nuevo;
- comparación ya aprobada;
- validaciones ya aprobadas.


======================================================================
43. ESTADO ACTUAL PARA RETOMAR — ACTUALIZACIÓN MÁS RECIENTE
FECHA: 01/10/2026
======================================================================

ESTADO FUNCIONAL:
COMPLETO dentro del alcance definido.

BLOQUES CERRADOS:
[OK] Formación centralizada.
[OK] CRUD de formación.
[OK] Auditoría.
[OK] Notificaciones reales.
[OK] Respaldo/restauración.
[OK] Escalabilidad.
[OK] Corrección controlada de asistencia.
[OK] Cierre/reapertura.
[OK] Módulo de excusas.
[OK] Pruebas visuales de Administrador.
[OK] Pruebas visuales de Instructor.
[OK] Aprendiz móvil.
[OK] QR generado.
[OK] QR físico con celular real.
[OK] Consola sin errores críticos.
[OK] MySQL 8.4 LTS.
[OK] Migraciones.
[OK] db:cutover.
[OK] db:validate.
[OK] db:activate.
[OK] DATA_SOURCE=mysql.
[OK] health check MySQL.
[OK] lectura autenticada HTTP 200.
[OK] persistencia después de reinicio.
[OK] seguridad y retiro de credenciales del código.
[OK] rotación de credenciales históricas.
[OK] Git estabilizado.
[OK] GitHub configurado.
[OK] colaboración configurada.
[OK] commit CI bcf72da publicado.
[OK] causa del CI rojo identificada.
[OK] corrección CI implementada localmente.
[OK] npm ci limpio.
[OK] npm test limpio.
[OK] 0 vulnerabilidades en la validación limpia.

PENDIENTES DE CIERRE:

1. COMMIT DE CORRECCIÓN CI
   Crear únicamente:
   test: aislar credenciales de prueba para CI

   Incluir:
   - pruebas/prueba_proyecto.js
   - pruebas/prueba_reportes.js

2. PUSH
   Publicar ese commit en origin/main.

3. GITHUB ACTIONS
   Verificar la nueva ejecución asociada al nuevo hash.
   Debe quedar en verde.

4. CONGELACIÓN
   Si CI queda verde, declarar ese commit como versión estable.

5. ZIP FINAL
   Generarlo de forma reproducible desde el último commit estable.

   NO utilizar f84ea38 como origen si existe un commit estable posterior.

   Excluir:
   - .env;
   - secretos;
   - credenciales;
   - datos operativos;
   - node_modules;
   - logs;
   - respaldos;
   - dumps privados;
   - archivos locales;
   - git_proceso_Sistema.md;
   - cambios sin seguimiento.

6. VERIFICACIÓN DEL ZIP
   Confirmar contenido e integridad antes de etiquetar la versión.

7. TAG FINAL
   Crear el tag únicamente después de CI verde y ZIP aprobado.

TAG SUGERIDO:
v5.0.0-mysql

REGLA:
No publicar el tag automáticamente sin autorización explícita.

ARCHIVO LOCAL A PROTEGER:
git_proceso_Sistema.md

ESTADO:
sin seguimiento.

NO:
- editar;
- agregar al staging;
- incluir en commit;
- incluir en ZIP.


======================================================================
44. PUNTO EXACTO PARA CONTINUAR
FECHA: 01/10/2026
======================================================================

1. Ejecutar git status.
2. Confirmar que únicamente estén modificados:
   - pruebas/prueba_proyecto.js
   - pruebas/prueba_reportes.js
3. Confirmar que git_proceso_Sistema.md permanezca sin seguimiento.
4. Revisar sin modificar:
   - git diff --stat
   - git diff
   - git diff --check
5. Preparar explícitamente únicamente los dos archivos de pruebas.
6. Crear el commit:
   test: aislar credenciales de prueba para CI
7. Confirmar el hash nuevo.
8. Verificar que git_proceso_Sistema.md no esté incluido.
9. Publicar el commit en origin/main.
10. Localizar la ejecución de GitHub Actions correspondiente al nuevo hash.
11. Esperar su finalización.
12. Confirmar npm ci y npm test en verde.
13. Solo con CI verde, congelar esa versión.
14. Generar el ZIP final desde ese commit estable.
15. Inspeccionar el ZIP.
16. Crear el tag final.
17. No publicar el tag sin autorización explícita.

NO HACER AL RETOMAR:
- no repetir MySQL;
- no repetir migraciones;
- no repetir cutover;
- no repetir activación;
- no repetir importaciones;
- no repetir prueba QR física;
- no agregar funcionalidades nuevas;
- no modificar módulos funcionales sin causa técnica;
- no mover aprendices;
- no alterar la ficha 3349881;
- no modificar git_proceso_Sistema.md;
- no incluir git_proceso_Sistema.md en ningún commit o ZIP;
- no repetir npm test local sin causa técnica nueva;
- no generar ZIP antes de CI verde;
- no crear tag antes de verificar el ZIP;
- no publicar tag sin autorización.

CONDICIÓN FINAL DE CIERRE:
- commit de corrección CI publicado;
- GitHub Actions en verde;
- ZIP final reproducible y revisado;
- tag final creado.

======================================================================
45. REPORTE DE AVANCE — CI VERDE, REFACTOR HTTP, GIT Y RECUPERACIÓN ADMINISTRATIVA
FECHA: 02/10/2026
HORA DE CORTE: 07:27 a. m. — UTC-5
======================================================================

CONTINUIDAD DEL HISTORIAL:
Este bloque continúa directamente después del punto 44.

El punto 44 conserva el estado y las instrucciones que eran correctas en
ese momento. Este punto 45 registra lo que efectivamente ocurrió después y
reemplaza esos pendientes únicamente como ESTADO ACTUAL.

No se eliminan ni reescriben los bloques anteriores porque forman parte de
la trazabilidad real del proyecto.


----------------------------------------------------------------------
45.1 CORRECCIÓN DE PRUEBAS PARA CI
----------------------------------------------------------------------

OBJETIVO:
Eliminar la dependencia accidental de dos pruebas respecto al archivo
.env local, de modo que la suite pudiera ejecutarse también en un entorno
limpio como GitHub Actions.

COMMIT CREADO:

1443cb6
test: configurar credenciales requeridas en CI

CAMBIOS VERIFICADOS:

- pruebas/prueba_proyecto.js:
  se agregó una credencial administrativa exclusivamente de prueba para
  que createProjectServer no dependiera del .env local.

- pruebas/prueba_reportes.js:
  se proporcionó explícitamente instructorPassword al servidor de pruebas.

ALCANCE:
- credenciales únicamente de prueba;
- no son credenciales operativas;
- no se modificó .env;
- no se modificó MySQL;
- no se agregaron secretos reales;
- no se cambiaron datos de producción.

RESULTADO:
APROBADO.

IMPACTO:
La suite deja de depender del entorno privado de desarrollo y puede
ejecutarse correctamente en CI.


----------------------------------------------------------------------
45.2 REFACTOR DE UN BLOQUE DE servidor.js — UTILIDADES HTTP
----------------------------------------------------------------------

OBJETIVO:
Cumplir el paso de ingeniería definido para hoy:

CI
↓
elegir UN módulo de servidor.js
↓
separarlo correctamente
↓
crear pruebas específicas
↓
crear commit independiente

MÓDULO ELEGIDO:
Utilidades HTTP.

COMMIT:

4c21150
refactor: extraer utilidades HTTP del servidor

ARCHIVOS PRINCIPALES:

- servidor/modulos/http.js
- pruebas/prueba_http.js
- servidor/servidor.js
- package.json

RESUMEN DEL COMMIT:

- 4 archivos modificados.
- 88 inserciones.
- 34 eliminaciones.

CAMBIO ARQUITECTÓNICO:
La lógica HTTP reutilizable deja de permanecer mezclada dentro de
servidor.js y pasa a un módulo cohesivo.

PRUEBAS:
Se creó una prueba específica para el nuevo módulo HTTP y después se
ejecutó nuevamente la suite completa.

RESULTADO:
APROBADO.

IMPORTANCIA:
Este cambio no agrega una función visual nueva. Mejora mantenibilidad,
separación de responsabilidades y capacidad de probar el backend sin
alterar su comportamiento funcional.


----------------------------------------------------------------------
45.3 PUSH Y SINCRONIZACIÓN DE GIT
----------------------------------------------------------------------

PUSH REALIZADO:

bcf72da..4c21150  main -> main

COMMITS PUBLICADOS EN ESA OPERACIÓN:

1443cb6
test: configurar credenciales requeridas en CI

4c21150
refactor: extraer utilidades HTTP del servidor

ESTADO DESPUÉS DEL PUSH:

main = origin/main

ARCHIVOS LOCALES QUE PERMANECIERON SIN SEGUIMIENTO:

- MEJORAS_ACTUALIZADO.md
- git_proceso_Sistema.md

VALIDACIÓN:
Los dos archivos locales permanecieron intactos y no fueron incluidos en
los commits.

RESULTADO:
APROBADO.


----------------------------------------------------------------------
45.4 GITHUB ACTIONS — CI CORREGIDA Y VERDE
----------------------------------------------------------------------

HASH VALIDADO:

4c211506663c7118e2338330834d7ae7c9b7957f

WORKFLOW:
Pruebas Sistema de Asistencia.

RESULTADO REMOTO:
success

PASOS CONFIRMADOS:

[OK] Checkout.
[OK] Instalación de dependencias.
[OK] npm ci.
[OK] npm test.
[OK] Finalización completa del workflow.

CONCLUSIÓN:
El fallo anterior de CI queda resuelto.

ESTADO ACTUAL DE CI:
VERDE.

YA NO ES NECESARIO:
- volver a diagnosticar el fallo original de CI;
- volver a corregir las dos pruebas anteriores;
- volver a configurar el workflow por ese mismo problema;
- repetir el análisis del .env como causa de aquel fallo.

Solo se debe volver a investigar CI si aparece un fallo NUEVO asociado a
cambios posteriores.


----------------------------------------------------------------------
45.5 RECUPERACIÓN ADMINISTRATIVA SEGURA
----------------------------------------------------------------------

OBJETIVO:
Cerrar el pendiente histórico en el que la recuperación del administrador
dependía de npm run reset:admin.

COMMIT:

dcb537b
feat: agregar recuperación administrativa segura

HASH COMPLETO:

dcb537b32ca0264a0a587507885be1bbe322bc48

FLUJO IMPLEMENTADO:

Inicio de sesión
      |
      v
Olvidé mi contraseña
      |
      v
Solicitud de recuperación
      |
      v
Correo administrativo
      |
      v
OTP de recuperación
      |
      v
Validación
      |
      v
Nueva contraseña
      |
      v
Invalidación de sesiones anteriores
      |
      v
Acceso con la nueva credencial

SEGURIDAD IMPLEMENTADA:

[OK] OTP de recuperación separado del OTP de acceso.
[OK] OTP protegido mediante HMAC.
[OK] Expiración: 10 minutos.
[OK] OTP de un solo uso.
[OK] Máximo de 5 intentos.
[OK] Espera entre solicitudes.
[OK] Límite horario de solicitudes.
[OK] Respuesta antienumeración.
[OK] Contraseña protegida con scrypt.
[OK] Contraseña anterior invalidada al completar el cambio.
[OK] Sesiones administrativas anteriores invalidadas.
[OK] Auditoría sin contraseña, OTP, hash, salt ni secretos.
[OK] Persistencia sin contraseña u OTP en texto plano.

RESPUESTA ANTENUMERACIÓN:
La solicitud de recuperación no revela si:
- el correo existe;
- el correo pertenece a un administrador;
- la cuenta está autorizada para recuperación.

Esto evita utilizar el endpoint para descubrir cuentas válidas.


----------------------------------------------------------------------
45.6 PERSISTENCIA DE CREDENCIALES ADMINISTRATIVAS EN MODO MYSQL
----------------------------------------------------------------------

HALLAZGO:
Durante la implementación se detectó que las credenciales administrativas
no deben trasladarse a MySQL únicamente porque DATA_SOURCE=mysql sea la
fuente operacional de la aplicación.

DISEÑO CONSERVADO:
MySQL mantiene los perfiles y datos operativos.

La credencial administrativa sensible permanece en el mecanismo local
ignorado por Git definido para autenticación.

AJUSTE:
Se corrigió la condición de persistencia para que el cambio de contraseña
sea durable también cuando el sistema opera con MySQL.

PRUEBAS:
Las pruebas utilizan archivos temporales y no el archivo real de
credenciales del equipo.

RESULTADO:
La recuperación administrativa no queda limitada al proceso en memoria y
la nueva credencial persiste de forma compatible con la arquitectura de
seguridad ya establecida.

NO SE HIZO:
- guardar passwordHash administrativo en MySQL;
- guardar salt administrativo en MySQL;
- guardar contraseña administrativa en MySQL;
- guardar OTP de recuperación en texto plano.


----------------------------------------------------------------------
45.7 PRUEBAS DE RECUPERACIÓN ADMINISTRATIVA
----------------------------------------------------------------------

SE VALIDARON LOS CASOS SOLICITADOS:

[OK] 1. Solicitud válida.
[OK] 2. Correo inexistente con respuesta indistinguible.
[OK] 3. Cuenta no administrativa con respuesta indistinguible.
[OK] 4. OTP correcto.
[OK] 5. OTP incorrecto.
[OK] 6. OTP expirado.
[OK] 7. Límite de intentos.
[OK] 8. Espera entre solicitudes.
[OK] 9. Reutilización de OTP rechazada.
[OK] 10. Cambio de contraseña correcto.

TAMBIÉN VALIDADO:

[OK] nueva contraseña funciona;
[OK] contraseña anterior deja de funcionar;
[OK] sesiones administrativas anteriores quedan invalidadas;
[OK] auditoría registra el flujo;
[OK] persistencia no contiene contraseña en texto plano;
[OK] persistencia no contiene OTP en texto plano.

NPM TEST:
APROBADO.

CÓDIGO DE SALIDA:
0.


----------------------------------------------------------------------
45.8 COMMIT, PUSH Y CI DE RECUPERACIÓN
----------------------------------------------------------------------

COMMIT:

dcb537b
feat: agregar recuperación administrativa segura

PUSH:
COMPLETADO.

DESTINO:
origin/main

HASH VALIDADO:

dcb537b32ca0264a0a587507885be1bbe322bc48

GITHUB ACTIONS:

[OK] checkout.
[OK] npm ci.
[OK] npm test.
[OK] workflow finalizado con success.

ESTADO DE MAIN:
Sincronizada con origin/main.

ARCHIVOS NO VERSIONADOS:
- MEJORAS_ACTUALIZADO.md
- git_proceso_Sistema.md

ESTADO DE LOS ARCHIVOS:
Intactos.

RESULTADO:
RECUPERACIÓN ADMINISTRATIVA APROBADA Y CERRADA.


----------------------------------------------------------------------
45.9 GIT — ESTADO ACTUAL Y TRABAJO QUE YA NO DEBE REPETIRSE
----------------------------------------------------------------------

ESTADO ACTUAL VERIFICADO:

Git local
   |
   v
main
   |
   v
origin/main
   |
   v
SINCRONIZADOS

GITHUB ACTIONS:
VERDE.

CONFIGURACIÓN GIT/GITHUB YA CERRADA:

[OK] repositorio definitivo configurado;
[OK] main publicada;
[OK] colaboración configurada;
[OK] workflow de GitHub Actions creado;
[OK] pruebas aisladas del .env;
[OK] CI ejecutándose en entorno limpio;
[OK] commits actuales publicados;
[OK] GitHub Actions verde;
[OK] recuperación administrativa publicada y validada.

POR LO TANTO, YA NO ES UN PENDIENTE ACTUAL:

- configurar nuevamente Git;
- crear nuevamente el repositorio;
- rehacer la configuración de GitHub;
- recrear el workflow CI;
- repetir el diagnóstico del fallo de CI inicial;
- volver a publicar 1443cb6;
- volver a publicar 4c21150;
- volver a publicar dcb537b;
- repetir la recuperación administrativa;
- repetir MySQL;
- repetir cutover;
- repetir db:activate;
- repetir la prueba QR física.

Git seguirá utilizándose normalmente para los PRÓXIMOS cambios:
- commit;
- push;
- Pull Request cuando corresponda;
- historial;
- GitHub Actions.

Esto es uso normal de Git y no significa que la CONFIGURACIÓN de Git siga
pendiente.


----------------------------------------------------------------------
45.10 GRÁFICA DE ESTADO TÉCNICO ACTUAL
----------------------------------------------------------------------

NOTA:
Las barras siguientes representan ESTADO DE CIERRE por área.
No deben interpretarse como una medición científica de rendimiento.

MySQL                       ████████████████████  COMPLETO
QR físico                   ████████████████████  COMPLETO
Seguridad de credenciales   ████████████████████  COMPLETO
Pruebas locales             ████████████████████  COMPLETO
Git / GitHub                ████████████████████  COMPLETO
GitHub Actions / CI         ████████████████████  COMPLETO
Refactor HTTP               ████████████████████  COMPLETO
Recuperación administrativa ████████████████████  COMPLETO
Reportes                    ███████████████░░░░░  AUDITORÍA EN CURSO
Arquitectura backend        ████████████████░░░░  MEJORA PROGRESIVA
Pulido / casos límite       █████████████████░░░  PENDIENTE FINAL


----------------------------------------------------------------------
45.11 GRÁFICA DE EVOLUCIÓN DEL TRABAJO DE HOY
----------------------------------------------------------------------

ESTADO AL INICIAR:

CI publicada
      |
      v
FALLO EN npm test
      |
      v
Causa identificada:
dependencia accidental del .env

DESPUÉS:

1443cb6
Corrección de pruebas
      |
      v
4c21150
Separación de utilidades HTTP
      |
      v
push a main
      |
      v
GitHub Actions VERDE
      |
      v
dcb537b
Recuperación administrativa segura
      |
      v
push a main
      |
      v
GitHub Actions VERDE

RESULTADO DEL DÍA:

CI                         [ CERRADA ]
Refactor HTTP              [ CERRADO ]
Recuperación administrativa[ CERRADA ]
Git / GitHub               [ ESTABLE ]


----------------------------------------------------------------------
45.12 ESTADO DE LOS PENDIENTES HISTÓRICOS RELACIONADOS
----------------------------------------------------------------------

PENDIENTE HISTÓRICO:
Recuperación del administrador dependía de reset:admin.

ESTADO ACTUAL:
CERRADO mediante dcb537b.


PENDIENTE HISTÓRICO:
GitHub Actions estaba en rojo.

ESTADO ACTUAL:
CERRADO.
Workflow verde en 4c21150 y posteriormente verde en dcb537b.


PENDIENTE HISTÓRICO:
Corregir pruebas dependientes del .env y publicar el cambio.

ESTADO ACTUAL:
CERRADO mediante 1443cb6.


PENDIENTE HISTÓRICO:
Separar gradualmente responsabilidades de servidor.js.

ESTADO ACTUAL:
PARCIALMENTE AVANZADO.
Se extrajo el módulo HTTP en 4c21150.
La mejora arquitectónica continúa de forma incremental, un bloque por vez.


PENDIENTE HISTÓRICO:
Administración completa de reportes.

ESTADO ACTUAL:
SIGUE ABIERTO.
Se inició auditoría de solo lectura para determinar exactamente qué ya
existe y qué falta antes de modificar código.


----------------------------------------------------------------------
45.13 ESTADO ACTUAL DE DESARROLLO
----------------------------------------------------------------------

El proyecto continúa en CONSTRUCCIÓN ACTIVA.

No se considera una versión congelada porque el trabajo seguirá hasta la
fecha prevista de entrega.

La medición usada durante estas revisiones sitúa el desarrollo
aproximadamente en:

97.5 / 100

Esta cifra es una ESTIMACIÓN DE SEGUIMIENTO, no una calificación automática.

La razón por la que todavía no se registra 100/100 es que existen puntos
concretos todavía abiertos:

1. terminar la auditoría de administración de reportes;
2. implementar únicamente las funciones realmente faltantes del ciclo de
   vida de reportes;
3. continuar la separación arquitectónica del backend donde todavía sea
   necesaria;
4. realizar el pulido final y revisar casos límite nuevos derivados de los
   cambios actuales.

GRÁFICA GENERAL DE SEGUIMIENTO:

ACTUAL
███████████████████░
≈97.5/100

META DE DESARROLLO
████████████████████
100/100


----------------------------------------------------------------------
45.14 TRABAJO ACTUAL — ADMINISTRACIÓN DE REPORTES
----------------------------------------------------------------------

ESTADO:
AUDITORÍA DE SOLO LECTURA EN CURSO.

OBJETIVO:
No agregar funciones a ciegas.

SE ESTÁ VERIFICANDO:

- generación de reportes;
- listado;
- consulta;
- búsqueda;
- filtros;
- descarga PDF;
- persistencia;
- permisos;
- auditoría;
- eliminación;
- archivado;
- restauración de archivados si aplica;
- política de retención;
- interfaz;
- rutas;
- pruebas automáticas.

REGLA:
Primero identificar lo que ya existe.

Después:
implementar únicamente lo necesario para cerrar el ciclo de vida de
reportes.

NO SE DEBE:
- duplicar funciones;
- modificar MySQL sin justificación;
- crear migraciones innecesarias;
- alterar módulos ya cerrados;
- mezclar el cambio con otro refactor grande.


----------------------------------------------------------------------
45.15 DIFERENCIA ENTRE DESARROLLO AL 100% Y ENTREGA FINAL
----------------------------------------------------------------------

DESARROLLO AL 100%:
Significa que las funciones y mejoras técnicas definidas para el alcance
actual han quedado completadas y verificadas.

ENTREGA FINAL:
Es una etapa posterior que se realizará cerca de la fecha de entrega.

INCLUYE:
- congelar un commit estable;
- generar ZIP final;
- verificar el ZIP;
- crear tag/release si se decide;
- consolidar documentación;
- preparar sustentación.

DECISIÓN ACTUAL:
No generar ZIP definitivo ni tag final ahora.

MOTIVO:
El proyecto continuará evolucionando hasta diciembre.

Por tanto, ZIP y tag no se consideran el siguiente trabajo funcional ni
deben utilizarse para inflar artificialmente el porcentaje de desarrollo.


----------------------------------------------------------------------
45.16 QUÉ FALTA REALMENTE PARA LLEGAR AL 100% DE DESARROLLO
----------------------------------------------------------------------

1. ADMINISTRACIÓN DE REPORTES

PRIMERO:
Terminar la auditoría actual.

DESPUÉS:
Cerrar únicamente las capacidades realmente ausentes.

El plan histórico exige revisar:
- consultar;
- descargar;
- archivar;
- eliminar con confirmación;
- permisos;
- auditoría;
- retención.

No se marcará este bloque como completo hasta conocer el resultado real de
la auditoría.


2. ARQUITECTURA BACKEND

ESTADO:
Mejora incremental.

YA HECHO:
- separación de utilidades HTTP;
- prueba específica del módulo;
- commit independiente.

FALTA:
Revisar las responsabilidades que aún permanezcan concentradas en
servidor.js y extraer solo bloques cohesivos cuando exista una razón real.

REGLA:
Un módulo por vez.
Pruebas.
Commit independiente.
CI.


3. PULIDO Y CASOS LÍMITE

Al terminar los cambios funcionales restantes:

- revisar validaciones;
- mensajes de error;
- permisos;
- estados vacíos;
- comportamientos después de reinicio;
- errores nuevos de consola;
- regresiones;
- casos límite detectados durante uso real.

No repetir pruebas históricas sin una causa técnica nueva.


----------------------------------------------------------------------
45.17 LO QUE NO DEBE VOLVER A CONTARSE COMO PENDIENTE
----------------------------------------------------------------------

[OK] MySQL definitivo.
[OK] Migraciones.
[OK] db:cutover.
[OK] db:validate.
[OK] db:activate.
[OK] DATA_SOURCE=mysql.
[OK] persistencia después de reinicio.
[OK] ficha histórica 3349881.
[OK] 0 relaciones rotas.
[OK] QR físico.
[OK] seguridad de credenciales.
[OK] rotación de credenciales históricas.
[OK] Git estabilizado.
[OK] GitHub configurado.
[OK] GitHub Actions configurado.
[OK] fallo inicial de CI corregido.
[OK] npm ci en GitHub Actions.
[OK] npm test en GitHub Actions.
[OK] refactor HTTP.
[OK] recuperación administrativa.

Estos bloques solo deben abrirse de nuevo si aparece evidencia concreta de
un fallo nuevo.


----------------------------------------------------------------------
45.18 PRÓXIMO PASO ÚNICO
----------------------------------------------------------------------

Esperar el resultado de la auditoría actual de ADMINISTRACIÓN DE REPORTES.

Cuando termine la auditoría:

1. registrar qué ya existe;
2. registrar qué está parcial;
3. registrar qué falta;
4. decidir el cambio mínimo necesario;
5. implementar solo ese cambio;
6. crear pruebas específicas;
7. ejecutar npm test;
8. crear commit independiente;
9. publicar cuando se autorice;
10. validar GitHub Actions sobre el hash nuevo.

NO INICIAR EN PARALELO:
- ZIP final;
- tag final;
- nueva migración sin necesidad;
- otro cambio grande no relacionado.


----------------------------------------------------------------------
45.19 RESUMEN EJECUTIVO DEL DÍA
----------------------------------------------------------------------

SE COMPLETÓ:

[OK] Corrección de pruebas para CI.
[OK] Commit 1443cb6.
[OK] Refactor de utilidades HTTP.
[OK] Commit 4c21150.
[OK] Push de ambos commits.
[OK] GitHub Actions verde.
[OK] Recuperación administrativa desde la aplicación.
[OK] OTP de recuperación seguro.
[OK] Nueva contraseña con scrypt.
[OK] Invalidación de sesiones.
[OK] Persistencia compatible con modo MySQL.
[OK] Pruebas específicas.
[OK] Commit dcb537b.
[OK] Push de dcb537b.
[OK] GitHub Actions verde sobre dcb537b.
[OK] main sincronizada con origin/main.

EN CURSO:

[ ] Auditoría de administración de reportes.

DESPUÉS:

[ ] Cerrar únicamente los faltantes reales de reportes.
[ ] Continuar arquitectura backend de forma incremental.
[ ] Pulido/casos límite.

ENTREGA DE DICIEMBRE, NO AHORA:

[ ] ZIP definitivo.
[ ] Verificación del paquete final.
[ ] Tag/release final, si corresponde.
[ ] Congelación definitiva de versión.
[ ] Sustentación y evidencias finales.


======================================================================
FIN DEL BLOQUE 45 — ESTADO ACTUALIZADO AL 02/10/2026 07:27 a. m.
======================================================================

REGLA DE CONTINUIDAD PARA PRÓXIMOS REPORTES:

El próximo bloque nuevo deberá ser:

46.

No reutilizar el número 45.
No reiniciar la numeración.
No sustituir bloques anteriores.
Cada reporte nuevo debe añadirse después del último bloque para conservar
la secuencia cronológica y aumentar progresivamente el historial.


======================================================================
46. VALORACIÓN COMERCIAL Y PLAN DE VENTA DEL SISTEMA
FECHA: 02/10/2026
======================================================================

VALOR COMERCIAL PROPUESTO:

$35.000.000 COP

OBJETIVO:

Definir un precio comercial defendible para el Sistema de Asistencia SENA
según el alcance funcional y técnico que ya posee actualmente.

----------------------------------------------------------------------
46.1 ¿POR QUÉ SE VALORA EN $35.000.000 COP?
----------------------------------------------------------------------

El proyecto no corresponde únicamente a una página web ni a un CRUD
básico.

Actualmente integra en un mismo sistema:

[OK] Administración de usuarios.
[OK] Roles Administrador, Coordinador, Instructor y Aprendiz.
[OK] Control de permisos.
[OK] Programas, fichas, horarios y ambientes.
[OK] Asistencia manual.
[OK] Asistencia mediante QR.
[OK] QR probado físicamente con celular real.
[OK] Estadísticas.
[OK] Generación de reportes PDF.
[OK] Auditoría de acciones.
[OK] Notificaciones.
[OK] Excusas y aprobación.
[OK] Corrección controlada de asistencia.
[OK] Cierre y reapertura de jornadas.
[OK] Respaldo y restauración.
[OK] MySQL como base de datos operacional.
[OK] Migraciones.
[OK] Recuperación administrativa mediante OTP.
[OK] Hash de contraseñas con scrypt.
[OK] Protección OTP mediante HMAC.
[OK] Invalidación de sesiones.
[OK] Pruebas automatizadas.
[OK] Git y GitHub.
[OK] Integración continua con GitHub Actions.
[OK] CI actualmente en verde.

Esto significa que el comprador no estaría adquiriendo solamente código:
estaría adquiriendo una base de software funcional, probada, documentada,
versionada y preparada para continuar evolucionando.

----------------------------------------------------------------------
46.2 REFERENCIA DEL SECTOR COLOMBIANO
----------------------------------------------------------------------

Referencias publicadas para Colombia en 2026 ubican una aplicación web de
complejidad media aproximadamente entre:

$25.000.000 y $60.000.000 COP

con estimaciones aproximadas de:

500 a 1.500 horas de desarrollo.

Otras firmas colombianas especializadas en software a medida manejan
rangos superiores cuando el sistema incluye múltiples roles, reglas de
negocio, procesos administrativos, seguridad, migraciones y operación
empresarial.

Por esta razón:

$35.000.000 COP

se considera un precio comercial conservador dentro del mercado y no una
valoración inflada.

----------------------------------------------------------------------
46.3 TIEMPO DE DESARROLLO EQUIVALENTE
----------------------------------------------------------------------

El historial del proyecto no contiene un control horario exacto de todas
las horas trabajadas, por lo que no sería correcto afirmar una cifra real
de horas acumuladas.

Sin embargo, tomando como referencia el alcance construido y las
estimaciones publicadas para aplicaciones web medianas, reproducir un
sistema equivalente desde cero puede representar aproximadamente:

500 a 700 horas de trabajo como estimación conservadora.

Ese esfuerzo incluye:

- análisis;
- diseño de interfaz;
- frontend;
- backend;
- base de datos;
- seguridad;
- lógica de negocio;
- QR;
- reportes;
- pruebas;
- corrección de errores;
- migración de datos;
- Git;
- CI;
- documentación;
- validaciones reales.

REFERENCIA SIMPLE DE VALOR:

600 horas aproximadas
x
$58.000 COP por hora equivalente
=
$34.800.000 COP

VALOR COMERCIAL REDONDEADO:

$35.000.000 COP

Esta operación se utiliza únicamente como modelo de valoración y no como
registro de horas efectivamente trabajadas.

----------------------------------------------------------------------
46.4 PROPUESTA DE VENTA
----------------------------------------------------------------------

PRODUCTO:

Sistema web de control y gestión de asistencia.

PRECIO DE OFERTA:

$35.000.000 COP

EL CLIENTE RECIBE:

- sistema funcional;
- código fuente;
- base de datos MySQL;
- módulos administrativos;
- control de asistencia;
- QR;
- reportes;
- seguridad;
- documentación técnica disponible;
- historial Git;
- pruebas automatizadas;
- configuración de CI;
- instalación y configuración acordadas dentro del alcance comercial.

PROPUESTA DE VALOR:

El sistema reduce procesos manuales de asistencia y concentra información
académica y administrativa en una plataforma única.

Permite controlar quién registra información, mantener trazabilidad,
consultar históricos, generar reportes y conservar evidencia mediante
auditoría.

----------------------------------------------------------------------
46.5 MINI PRESENTACIÓN COMERCIAL
----------------------------------------------------------------------

El Sistema de Asistencia SENA es una plataforma web desarrollada para
centralizar y controlar el proceso de asistencia de una institución.

Integra usuarios con diferentes roles, formación, horarios, ambientes,
asistencia manual y mediante QR, reportes, auditoría, excusas,
notificaciones, recuperación segura de acceso y persistencia MySQL.

Su valor de $35.000.000 COP se sustenta en el número de procesos que ya
resuelve, la infraestructura técnica implementada, las medidas de
seguridad, las pruebas automatizadas y el tiempo de desarrollo equivalente
necesario para construir un producto de características similares.

No se vende como una simple interfaz web.

Se vende como una solución de software desarrollada, integrada y
verificada, con una base técnica preparada para personalización,
implementación institucional y evolución futura.

----------------------------------------------------------------------
46.6 POSICIÓN DE NEGOCIACIÓN
----------------------------------------------------------------------

PRECIO PUBLICADO:

$35.000.000 COP

ESTRATEGIA:

No competir por ser el software más barato.

La negociación debe basarse en:

- funcionalidades incluidas;
- ahorro de desarrollo desde cero;
- trazabilidad;
- seguridad;
- automatización;
- posibilidad de personalización;
- mantenimiento futuro;
- propiedad o licencia que se acuerde con el cliente.

El valor final podrá cambiar dependiendo de si la negociación incluye:

- código fuente;
- exclusividad;
- instalación;
- capacitación;
- personalización;
- alojamiento;
- soporte;
- mantenimiento.

----------------------------------------------------------------------
46.7 CONCLUSIÓN COMERCIAL
----------------------------------------------------------------------

VALOR PROPUESTO DEL SISTEMA ACTUAL:

$35.000.000 COP

La valoración es coherente con un proyecto web de complejidad media en el
mercado colombiano y se encuentra en la parte conservadora de los rangos
publicados para software a medida.

El precio se justifica principalmente por:

FUNCIONALIDAD
+
BASE DE DATOS
+
SEGURIDAD
+
AUTOMATIZACIÓN
+
PRUEBAS
+
AUDITORÍA
+
QR
+
REPORTES
+
VERSIONADO
+
CI
+
TIEMPO DE DESARROLLO EQUIVALENTE

=
$35.000.000 COP


======================================================================
FIN DEL BLOQUE 46 — VALORACIÓN COMERCIAL DEL PROYECTO
======================================================================

REGLA DE CONTINUIDAD:

El próximo bloque del historial deberá ser:

47.

No reutilizar el número 46.
No reemplazar el bloque 46.
Mantener la secuencia cronológica del historial.
======================================================================


======================================================================
FIN DEL HISTORIAL ACTUALIZADO — SISTEMA DE ASISTENCIA SENA
======================================================================


======================================================================
47. CIERRE DE ADMINISTRACIÓN DE REPORTES
FECHA: 02/10/2026
======================================================================

OBJETIVO:

Terminar la auditoría de solo lectura y completar únicamente las
capacidades faltantes del ciclo de vida de reportes.

---------------------------------------------------------------------
47.1 RESULTADO DE LA AUDITORÍA
---------------------------------------------------------------------

YA EXISTÍA:

[OK] Generación de reportes.
[OK] Listado e historial.
[OK] Consulta de detalle.
[OK] Búsqueda por ficha, fecha y autor.
[OK] Filtros de generación.
[OK] Descarga PDF.
[OK] Persistencia en archivos y MySQL.
[OK] Acceso para Administrador, Coordinador e Instructor.
[OK] Corte histórico inmutable aunque cambie la asistencia.

FALTABA:

[ ] Archivado.
[ ] Restauración de archivados.
[ ] Eliminación con confirmación.
[ ] Permisos diferenciados para administrar el ciclo de vida.
[ ] Auditoría de acciones sobre reportes.
[ ] Política explícita de retención.
[ ] Interfaz para operar estas funciones.

---------------------------------------------------------------------
47.2 CAMBIOS IMPLEMENTADOS
---------------------------------------------------------------------

[OK] Estado Activo o Archivado para cada informe.
[OK] Archivado y restauración desde la interfaz.
[OK] Eliminación permanente con confirmación en interfaz y API.
[OK] Solo Administrador y Coordinador pueden archivar, restaurar o
     eliminar.
[OK] El Instructor conserva consulta, generación y descarga.
[OK] Auditoría de creación, archivado, restauración, eliminación y
     depuración por retención.
[OK] Retención configurable mediante REPORTS_RETENTION_LIMIT.
[OK] Límite predeterminado de 500 informes.
[OK] Al alcanzar el límite se eliminan primero los archivados más
     antiguos; los informes activos no se eliminan silenciosamente.
[OK] Filtro de interfaz para Activos, Archivados y Todos.
[OK] No se creó una migración nueva: app_reports.payload ya conserva
     los nuevos metadatos de forma compatible.

---------------------------------------------------------------------
47.3 VALIDACIONES
---------------------------------------------------------------------

[OK] Sintaxis de servidor, rutas y JavaScript de interfaz.
[OK] Prueba específica npm run test:reports.
[OK] Suite completa npm test.
[OK] Persistencia después de reinicio.
[OK] PDF disponible para informes activos y archivados.
[OK] Instructor bloqueado en acciones administrativas.
[OK] Confirmación obligatoria para eliminar.
[OK] Auditoría verificada para todas las acciones nuevas.
[OK] Retención verificada con depuración del archivado más antiguo.
[OK] git diff --check sin errores.

---------------------------------------------------------------------
47.4 COMMIT Y PUBLICACIÓN
---------------------------------------------------------------------

COMMIT LOCAL:

afb82ff feat: completar administracion de reportes

ESTADO:

[OK] Commit independiente creado.
[ ] Push pendiente de autorización explícita.
[ ] GitHub Actions pendiente sobre afb82ff hasta publicar el commit.

No se incluyeron en el commit los documentos que ya permanecían sin
versionar.

---------------------------------------------------------------------
47.5 ESTADO ACTUAL
---------------------------------------------------------------------

ADMINISTRACIÓN DE REPORTES:

COMPLETA dentro del alcance histórico definido:

- consultar;
- descargar;
- archivar;
- restaurar;
- eliminar con confirmación;
- permisos;
- auditoría;
- retención.

SIGUIENTE BLOQUE DE DESARROLLO:

Continuar la arquitectura backend de manera incremental, un módulo
cohesivo por vez, únicamente después de publicar y validar este commit
cuando exista autorización.

NO CORRESPONDE TODAVÍA:

- ZIP definitivo;
- tag final;
- release final;
- congelación de versión.

======================================================================
FIN DEL BLOQUE 47 — ADMINISTRACIÓN DE REPORTES CERRADA
======================================================================

REGLA DE CONTINUIDAD:

El próximo bloque del historial deberá ser:

48.

No reutilizar el número 47.
No reemplazar bloques anteriores.
Mantener la secuencia cronológica del historial.


======================================================================
48. VALIDACIÓN REAL DE ADMINISTRACIÓN DE REPORTES
FECHA: 02/10/2026
======================================================================

ALCANCE:

Validar y reportar el estado real del módulo implementado en el bloque
47, sin agregar funcionalidades, refactorizar, publicar cambios ni
modificar datos operativos.

---------------------------------------------------------------------
48.1 PRUEBA AUTOMÁTICA ESPECÍFICA
---------------------------------------------------------------------

COMANDO:

npm run test:reports

RESULTADO:

[OK] Código de salida 0.
[OK] Prueba específica aprobada.
[OK] Listado y acceso.
[OK] Corte histórico inmutable.
[OK] Persistencia después de reinicio.
[OK] Descarga PDF.
[OK] Archivado.
[OK] Restauración.
[OK] Eliminación confirmada.
[OK] Permisos.
[OK] Auditoría.
[OK] Retención.

---------------------------------------------------------------------
48.2 CASOS FUNCIONALES DE REPORTES
---------------------------------------------------------------------

[OK] Listar reportes activos.
[OK] Listar reportes archivados.
[OK] Filtro Todos.
[OK] Archivar reporte.
[OK] El reporte archivado conserva sus datos.
[OK] Restaurar reporte.
[OK] Descargar reporte activo.
[OK] Descargar reporte archivado.
[OK] Eliminar reporte con autorización.
[OK] Exigir confirmación para eliminar.
[OK] El reporte eliminado deja de aparecer y devuelve 404.

---------------------------------------------------------------------
48.3 PERMISOS POR ROL
---------------------------------------------------------------------

ADMINISTRADOR:

[OK] Consulta.
[OK] Genera.
[OK] Descarga.
[OK] Archiva.
[OK] Restaura.
[OK] Elimina.

COORDINADOR:

[OK] Consulta.
[OK] Genera.
[OK] Descarga.
[OK] Archiva.
[OK] Restaura.
[OK] Elimina dentro del alcance administrativo implementado.

INSTRUCTOR:

[OK] Consulta.
[OK] Genera.
[OK] Descarga.
[OK] No puede archivar: backend devuelve 403.
[OK] No puede restaurar: backend devuelve 403.
[OK] No puede eliminar: backend devuelve 403.

RESULTADO BACKEND:

SÍ bloquea peticiones directas no autorizadas.

---------------------------------------------------------------------
48.4 AUDITORÍA
---------------------------------------------------------------------

[OK] Evento de archivado.
[OK] Evento de restauración.
[OK] Evento de eliminación.
[OK] Actor identificado.
[OK] Acción identificada.
[OK] Identificador del reporte.
[OK] Fecha del evento.
[OK] Transición Activo → Archivado.
[OK] Transición Archivado → Activo.
[OK] Estado previo registrado antes de eliminar.
[OK] No almacena el PDF completo.
[OK] No almacena secretos.
[OK] No almacena credenciales.

---------------------------------------------------------------------
48.5 RETENCIÓN
---------------------------------------------------------------------

LÍMITE PREDETERMINADO:

500 informes.

COMPORTAMIENTO VALIDADO:

- al alcanzar el límite se seleccionan primero los informes archivados;
- entre los archivados se elimina primero el más antiguo;
- la depuración del archivado es automática al crear un nuevo informe;
- los reportes activos no se eliminan arbitrariamente;
- si todos los reportes son activos y se alcanzó el límite, la creación
  se rechaza con HTTP 409;
- los informes activos existentes permanecen intactos.

CONFIGURACIÓN REAL IMPLEMENTADA:

REPORTS_RETENTION_LIMIT=500

OBSERVACIÓN:

El nombre real contiene REPORTS en plural. La solicitud de validación
usó REPORT_RETENTION_LIMIT en singular; esa variable singular no es la
que actualmente lee el código.

---------------------------------------------------------------------
48.6 PERSISTENCIA Y MYSQL
---------------------------------------------------------------------

INSTANCIA TEMPORAL:

[OK] Se archivó un reporte.
[OK] Permaneció Archivado después de reiniciar.
[OK] Se restauró el reporte.
[OK] Permaneció Activo después de un segundo reinicio.

MYSQL OPERACIONAL — VALIDACIÓN DE SOLO LECTURA:

[OK] DATA_SOURCE=mysql.
[OK] MySQL respondió ready=true.
[OK] La tabla app_reports existe.
[OK] Se encontraron 6 reportes operacionales.
[OK] No se modificaron datos operativos.

MYSQL DE PRUEBAS:

[ADVERTENCIA] DB_NAME_TEST existe, pero no contiene la tabla
app_reports. Por esa razón no fue posible completar una prueba dinámica
de archivado/restauración sobre MySQL de pruebas sin crear o modificar
su esquema.

No se ejecutaron migraciones ni cambios de esquema durante esta
validación.

---------------------------------------------------------------------
48.7 PRUEBA VISUAL EN NAVEGADOR
---------------------------------------------------------------------

VALIDADO COMO ADMINISTRADOR EN INSTANCIA TEMPORAL:

[OK] Filtro Activos.
[OK] Filtro Archivados.
[OK] Filtro Todos.
[OK] Estado Activo visible.
[OK] Estado Archivado visible.
[OK] Botón Archivar.
[OK] Botón Restaurar.
[OK] Confirmación antes de eliminar.
[OK] Descarga de reporte activo.
[OK] Descarga de reporte archivado.
[OK] Sin botones duplicados por tarjeta.
[OK] Sin flujo roto después de archivar o restaurar.
[OK] Sin errores ni advertencias críticos en consola.

VALIDACIÓN VISUAL POR ROL:

[ADVERTENCIA] La sesión visual independiente de Instructor y
Coordinador no se completó. Sus permisos sí quedaron comprobados por
API/backend y por la respuesta permissions.manage utilizada por la
interfaz para mostrar u ocultar controles administrativos.

---------------------------------------------------------------------
48.8 NODE CHECK Y SUITE COMPLETA
---------------------------------------------------------------------

NODE CHECK:

[OK] servidor/servidor.js.
[OK] servidor/rutas/formacion.js.
[OK] aplicacion/recursos/JS scripts/reportes.js.
[OK] aplicacion/recursos/JS scripts/estadisticas_informes.js.

NPM TEST:

[OK] Código de salida 0.
[OK] 13 scripts de prueba ejecutados.
[OK] 13 scripts aprobados.
[OK] 0 scripts fallidos.

---------------------------------------------------------------------
48.9 PROBLEMAS DETECTADOS
---------------------------------------------------------------------

1. La variable solicitada como REPORT_RETENTION_LIMIT no coincide con
   la implementación real REPORTS_RETENTION_LIMIT.

2. DB_NAME_TEST no tiene el esquema migrado y carece de app_reports.

3. La comprobación visual independiente para Instructor y Coordinador
   quedó pendiente, aunque los permisos del backend fueron aprobados.

---------------------------------------------------------------------
48.10 CONCLUSIÓN
---------------------------------------------------------------------

ADMINISTRACIÓN DE REPORTES:

REQUIERE CORRECCIÓN.

MOTIVO:

El flujo funcional principal y la seguridad del backend están
aprobados, pero todavía deben resolverse o verificarse expresamente los
tres puntos registrados en 48.9 antes de declarar el bloque totalmente
cerrado.

ACCIONES NO REALIZADAS DURANTE ESTA VALIDACIÓN:

[OK] No se agregaron funcionalidades.
[OK] No se refactorizó código.
[OK] No se modificaron datos operativos.
[OK] No se hizo push.
[OK] No se creó otro commit Git.

======================================================================
FIN DEL BLOQUE 48 — VALIDACIÓN DE ADMINISTRACIÓN DE REPORTES
======================================================================

REGLA DE CONTINUIDAD:

El próximo bloque del historial deberá ser:

49.

No reutilizar el número 48.
No reemplazar bloques anteriores.
Mantener la secuencia cronológica del historial.


======================================================================
49. PLAN PARA UN PROYECTO SÚPER FUNCIONAL Y SOSTENIBLE
FECHA: 02/10/2026
======================================================================

OBJETIVO:

Definir lo que falta para que Blue Magic V5 no solo funcione hoy, sino
que pueda instalarse, operarse, mantenerse, diagnosticarse y evolucionar
de forma segura durante los próximos años.

Este bloque no vuelve a abrir trabajos ya aprobados. Se concentra en los
pendientes reales detectados después del cierre funcional.

---------------------------------------------------------------------
49.1 PRIORIDAD 1 — CERRAR LOS HALLAZGOS DEL BLOQUE 48
---------------------------------------------------------------------

1. UNIFICAR LA VARIABLE DE RETENCIÓN

Decidir y documentar un único nombre:

REPORTS_RETENTION_LIMIT

Tareas:

- mantener el nombre real usado por el código;
- documentarlo en todas las guías de instalación;
- validar valores inválidos, demasiado bajos o excesivos;
- incluir una prueba que confirme el valor predeterminado de 500;
- comprobar que la aplicación informa el límite efectivo.

2. PREPARAR MYSQL DE PRUEBAS

Tareas:

- aplicar las migraciones vigentes a DB_NAME_TEST;
- comprobar que DB_NAME_TEST nunca coincide con DB_NAME;
- ejecutar pruebas de reportes con MySQL real de pruebas;
- probar archivado, reinicio, restauración y eliminación;
- revertir o limpiar únicamente los datos creados por la prueba;
- nunca utilizar la base operacional para pruebas destructivas.

3. COMPLETAR LA VALIDACIÓN VISUAL POR ROL

Tareas:

- Administrador: verificar todos los controles;
- Coordinador: verificar controles administrativos permitidos;
- Instructor: confirmar que solo vea consulta, generación y descarga;
- comprobar escritorio y móvil;
- revisar consola después de cada acción;
- documentar evidencias y resultado.

CRITERIO DE CIERRE:

El bloque 48 podrá cambiar de REQUIERE CORRECCIÓN a APROBADO únicamente
cuando estos tres puntos tengan evidencia verificable.

---------------------------------------------------------------------
49.2 PRIORIDAD 2 — PRUEBAS AUTOMÁTICAS SOSTENIBLES
---------------------------------------------------------------------

OBJETIVO:

Evitar que una mejora futura rompa silenciosamente permisos, datos o
flujos críticos.

FALTA:

- separar claramente pruebas unitarias, integración y end-to-end;
- crear una preparación automática de DB_NAME_TEST;
- generar y limpiar datos de prueba sin afectar datos reales;
- cubrir explícitamente Administrador, Coordinador, Instructor y
  Aprendiz;
- probar errores y casos límite, no solamente rutas exitosas;
- comprobar persistencia después de reinicio;
- probar restauración real de respaldos en entorno aislado;
- cubrir concurrencia en operaciones sensibles;
- definir una cobertura mínima para módulos críticos;
- conservar una prueba rápida para desarrollo y una suite completa para
  CI.

CASOS CRÍTICOS QUE DEBEN QUEDAR AUTOMATIZADOS:

[ ] Inicio y cierre de sesión.
[ ] Recuperación administrativa.
[ ] Gestión de usuarios y permisos.
[ ] Formación y dependencias.
[ ] Asistencia manual y QR.
[ ] Cierre, reapertura y correcciones.
[ ] Excusas.
[ ] Reportes y retención.
[ ] Auditoría.
[ ] Respaldo y restauración.
[ ] Persistencia MySQL después de reinicio.
[ ] Rechazo de acciones no autorizadas.

CRITERIO DE CIERRE:

La suite debe poder ejecutarse desde una instalación limpia con un solo
procedimiento documentado y sin depender de archivos secretos locales.

---------------------------------------------------------------------
49.3 PRIORIDAD 3 — ARQUITECTURA BACKEND MANTENIBLE
---------------------------------------------------------------------

ESTADO ACTUAL:

servidor.js todavía concentra varias responsabilidades.

PLAN INCREMENTAL:

- extraer un módulo cohesivo por vez;
- comenzar por reportes, porque ya tiene contrato y pruebas específicas;
- separar rutas, reglas de negocio y persistencia;
- conservar respuestas y comportamiento existentes;
- añadir pruebas antes de mover cada bloque;
- crear un commit independiente por extracción;
- ejecutar npm test después de cada paso;
- no realizar un refactor masivo.

ORDEN SUGERIDO:

1. Servicio y repositorio de reportes.
2. Estadísticas.
3. Auditoría.
4. Respaldo/restauración.
5. Asistencia y cierres.
6. Usuarios y autenticación.

CRITERIO DE CIERRE:

servidor.js debe quedar como punto de composición y arranque, mientras
las reglas de negocio residen en módulos pequeños, probables y con una
responsabilidad clara.

---------------------------------------------------------------------
49.4 PRIORIDAD 4 — OPERACIÓN, DIAGNÓSTICO Y OBSERVABILIDAD
---------------------------------------------------------------------

OBJETIVO:

Poder detectar y resolver fallos sin revisar manualmente todo el código.

FALTA:

- registros estructurados con fecha, nivel y contexto;
- identificador por solicitud para seguir errores de punta a punta;
- separación entre errores esperados y fallos internos;
- métricas básicas de salud, latencia y errores;
- health check de aplicación, MySQL y correo;
- alertas para fallos repetidos de correo, base de datos o respaldo;
- rotación y retención de logs;
- evitar contraseñas, OTP, tokens y datos sensibles en logs;
- guía de diagnóstico para los fallos más comunes;
- procedimiento para recopilar evidencia sin exponer secretos.

CRITERIO DE CIERRE:

Un operador debe poder responder rápidamente:

- si la aplicación está disponible;
- si MySQL está conectado;
- si el correo funciona;
- qué solicitud falló;
- cuándo ocurrió;
- qué módulo fue responsable;
- qué acción segura debe ejecutar.

---------------------------------------------------------------------
49.5 PRIORIDAD 5 — RESPALDO, RECUPERACIÓN Y CONTINUIDAD
---------------------------------------------------------------------

El respaldo ya existe, pero la sostenibilidad exige demostrar que puede
recuperar el sistema cuando realmente se necesite.

FALTA:

- programar respaldos con frecuencia definida;
- almacenar copias fuera de la misma instalación;
- cifrar respaldos cuando salgan del equipo;
- definir retención diaria, semanal y mensual;
- verificar automáticamente integridad y formato;
- ejecutar simulacros de restauración en entorno aislado;
- medir tiempo de recuperación;
- documentar responsable y procedimiento;
- definir RPO: pérdida máxima de datos aceptable;
- definir RTO: tiempo máximo esperado de recuperación;
- registrar cada simulacro y su resultado.

CRITERIO DE CIERRE:

No basta con generar un archivo. Debe existir por lo menos un simulacro
documentado que restaure una copia reciente y confirme usuarios,
formación, asistencia, reportes, auditoría y excusas.

---------------------------------------------------------------------
49.6 PRIORIDAD 6 — SEGURIDAD CONTINUA
---------------------------------------------------------------------

YA EXISTE:

- scrypt;
- OTP protegido;
- sesiones;
- permisos por rol;
- secretos fuera del repositorio;
- auditoría;
- npm audit sin vulnerabilidades en la revisión registrada.

FALTA PARA SOSTENERLO:

- revisión periódica de dependencias;
- política de actualización y parches;
- expiración y rotación documentada de secretos;
- cookies Secure obligatorias en producción HTTPS;
- cabeceras HTTP de seguridad revisadas;
- límites de tamaño y frecuencia en todos los endpoints sensibles;
- revisión de autorización por recurso, no solo por pantalla;
- pruebas automáticas de escalamiento de privilegios;
- política de retención de auditoría y datos personales;
- procedimiento de respuesta a incidentes;
- lista de secretos que deben rotarse ante una filtración;
- análisis de archivos adjuntos de excusas y validación de contenido;
- respaldo cifrado y acceso restringido.

CRITERIO DE CIERRE:

Cada endpoint sensible debe tener autenticación, autorización, límites,
validación, auditoría cuando corresponda y una prueba negativa.

---------------------------------------------------------------------
49.7 PRIORIDAD 7 — EXPERIENCIA DE USUARIO Y CASOS LÍMITE
---------------------------------------------------------------------

FALTA REVISAR:

- estados vacíos en todas las pantallas;
- carga lenta y pérdida temporal de conexión;
- mensajes comprensibles y accionables;
- doble clic y envíos repetidos;
- formularios con datos inválidos;
- sesiones vencidas durante una operación;
- conflictos de edición simultánea;
- navegación mediante teclado;
- foco visible y orden lógico;
- etiquetas y nombres accesibles;
- contraste;
- tablas y diálogos en móvil;
- lectores de pantalla;
- reducción de movimiento;
- impresión y descarga de informes;
- funcionamiento con volúmenes cercanos al máximo previsto.

CRITERIO DE CIERRE:

Cada flujo principal debe tener comportamiento definido para:

- éxito;
- datos vacíos;
- validación incorrecta;
- permiso insuficiente;
- desconexión;
- error del servidor;
- reintento seguro.

---------------------------------------------------------------------
49.8 PRIORIDAD 8 — RENDIMIENTO Y ESCALABILIDAD REAL
---------------------------------------------------------------------

La escala funcional definida está aprobada, pero falta medirla de forma
repetible.

FALTA:

- establecer tiempos máximos aceptables por pantalla y endpoint;
- medir consultas de estadísticas y reportes;
- revisar índices con datos representativos;
- evitar cargar colecciones completas cuando crezcan;
- paginar desde backend donde corresponda;
- probar concurrencia de QR y asistencia;
- medir consumo de memoria durante generación de PDF y respaldos;
- probar 300 usuarios y el volumen histórico esperado;
- documentar límites conocidos;
- definir cuándo escalar servidor, MySQL o almacenamiento.

CRITERIO DE CIERRE:

Debe existir una línea base reproducible con volumen, concurrencia,
latencia, memoria y resultado esperado.

---------------------------------------------------------------------
49.9 PRIORIDAD 9 — INSTALACIÓN Y DESPLIEGUE REPRODUCIBLES
---------------------------------------------------------------------

FALTA:

- guía única desde equipo limpio hasta aplicación operativa;
- versiones mínimas de Node.js y MySQL;
- preparación de base, usuario y permisos mínimos;
- migraciones automáticas controladas;
- validación de variables de entorno antes de iniciar;
- HTTPS y dominio para producción;
- servicio automático con reinicio ante fallos;
- ubicación de datos, logs y respaldos;
- procedimiento de actualización sin pérdida de datos;
- rollback de aplicación y base de datos;
- lista de comprobación posterior al despliegue;
- separación clara entre desarrollo, pruebas y producción.

CRITERIO DE CIERRE:

Otra persona debe poder desplegar el sistema siguiendo la documentación,
sin depender de conocimiento verbal del desarrollador original.

---------------------------------------------------------------------
49.10 PRIORIDAD 10 — DOCUMENTACIÓN Y TRANSFERENCIA
---------------------------------------------------------------------

DOCUMENTOS NECESARIOS:

- arquitectura actual;
- mapa de módulos;
- modelo de datos;
- contratos principales de API;
- matriz de roles y permisos;
- instalación y actualización;
- respaldo y recuperación;
- solución de problemas;
- operación diaria;
- mantenimiento preventivo;
- política de retención;
- seguridad y rotación de secretos;
- guía de pruebas;
- manual breve por rol;
- registro de decisiones técnicas.

CRITERIO DE CIERRE:

El proyecto debe poder continuar aunque cambie la persona encargada de
desarrollo, soporte o administración.

---------------------------------------------------------------------
49.11 PRIORIDAD 11 — PROCESO DE CAMBIOS Y VERSIONADO
---------------------------------------------------------------------

REGLAS RECOMENDADAS:

- una mejora concreta por commit;
- pruebas antes de commit;
- revisión del diff;
- Pull Request para cambios de riesgo;
- CI verde antes de integrar;
- migraciones versionadas y reversibles;
- notas de cambio comprensibles;
- versiones identificables;
- no mezclar datos, secretos o respaldos en Git;
- no modificar migraciones ya aplicadas;
- etiquetar releases solo cuando exista una versión entregable;
- conservar una estrategia de rollback.

CRITERIO DE CIERRE:

Cada cambio debe ser trazable desde la necesidad hasta el código, las
pruebas, la revisión y la versión donde se publicó.

---------------------------------------------------------------------
49.12 ORDEN RECOMENDADO DE EJECUCIÓN
---------------------------------------------------------------------

FASE 1 — CIERRE INMEDIATO

1. Resolver los tres hallazgos del bloque 48.
2. Validar reportes completamente sobre DB_NAME_TEST.
3. Completar validación visual por roles.
4. Ejecutar npm test.
5. Crear un commit independiente.
6. Publicar cuando se autorice.
7. Confirmar GitHub Actions verde.

FASE 2 — SOSTENIBILIDAD TÉCNICA

1. Extraer el módulo de reportes del servidor principal.
2. Organizar pruebas por nivel.
3. Automatizar preparación y limpieza de MySQL de pruebas.
4. Implementar logs estructurados y diagnóstico.
5. Reforzar pruebas negativas de seguridad.

FASE 3 — OPERACIÓN CONFIABLE

1. Automatizar respaldos.
2. Ejecutar simulacro de restauración.
3. Documentar RPO y RTO.
4. Medir rendimiento.
5. Terminar guías de instalación, actualización y soporte.

FASE 4 — CIERRE DE ENTREGA

Solo cerca de la entrega:

1. congelar un commit estable;
2. ejecutar suite completa;
3. probar instalación limpia;
4. revisar secretos y datos de demostración;
5. generar ZIP final;
6. verificar el ZIP;
7. crear tag/release si corresponde;
8. preparar evidencias y sustentación.

---------------------------------------------------------------------
49.13 DEFINICIÓN DE PROYECTO SÚPER FUNCIONAL
---------------------------------------------------------------------

BLUE MAGIC será SÚPER FUNCIONAL cuando:

[ ] Todos los flujos principales funcionen por rol.
[ ] Los errores y casos vacíos estén controlados.
[ ] Los permisos se apliquen en interfaz y backend.
[ ] Los datos sobrevivan reinicios y actualizaciones.
[ ] Los reportes, QR, asistencia y respaldos tengan pruebas reales.
[ ] No existan errores críticos de consola o servidor.
[ ] El rendimiento sea aceptable con la escala objetivo.
[ ] La experiencia sea usable en PC y móvil.

---------------------------------------------------------------------
49.14 DEFINICIÓN DE PROYECTO SOSTENIBLE
---------------------------------------------------------------------

BLUE MAGIC será SOSTENIBLE cuando:

[ ] Otra persona pueda instalarlo y mantenerlo.
[ ] Exista separación clara entre desarrollo, pruebas y producción.
[ ] Las pruebas sean repetibles y no dependan del .env personal.
[ ] Los cambios tengan CI, revisión y rollback.
[ ] Los respaldos se prueben, no solo se generen.
[ ] Los errores puedan diagnosticarse mediante logs seguros.
[ ] Las dependencias y secretos tengan mantenimiento periódico.
[ ] La arquitectura permita cambiar un módulo sin romper todo el sistema.
[ ] La documentación refleje el estado real.
[ ] Exista un responsable y calendario de mantenimiento.

---------------------------------------------------------------------
49.15 INDICADORES DE MANTENIMIENTO
---------------------------------------------------------------------

SEMANAL:

- revisar health check;
- revisar errores críticos;
- verificar respaldos;
- confirmar espacio disponible.

MENSUAL:

- ejecutar suite completa;
- revisar dependencias;
- revisar accesos y usuarios inactivos;
- comprobar tamaño de auditoría, reportes y logs;
- validar al menos un respaldo reciente.

TRIMESTRAL:

- simulacro de restauración;
- revisión de seguridad;
- prueba de rendimiento;
- revisión de permisos por rol;
- actualización de documentación.

POR CADA RELEASE:

- npm test;
- node --check;
- GitHub Actions verde;
- migraciones verificadas;
- respaldo previo;
- lista de cambios;
- plan de rollback;
- prueba posterior al despliegue.

---------------------------------------------------------------------
49.16 LO QUE NO DEBE REABRIRSE SIN EVIDENCIA NUEVA
---------------------------------------------------------------------

[OK] MySQL operacional definitivo.
[OK] Cutover y activación.
[OK] Ficha histórica 3349881.
[OK] QR físico.
[OK] Recuperación administrativa.
[OK] Corrección controlada de asistencia.
[OK] Excusas.
[OK] Git y GitHub configurados.
[OK] Workflow de CI existente.
[OK] Seguridad básica de credenciales.

Estos bloques solo deben reabrirse si una prueba nueva demuestra un
fallo concreto.

---------------------------------------------------------------------
49.17 SIGUIENTE PASO ÚNICO
---------------------------------------------------------------------

Resolver el punto 49.1 sin mezclarlo con refactor arquitectónico:

1. confirmar el nombre definitivo de la variable de retención;
2. preparar DB_NAME_TEST con las migraciones actuales;
3. ejecutar la prueba completa de reportes sobre MySQL de pruebas;
4. completar la prueba visual independiente de Coordinador e Instructor;
5. registrar resultados;
6. ejecutar npm test;
7. crear un único commit de corrección si realmente hubo cambios.

NO INICIAR EN PARALELO:

- refactor grande;
- ZIP final;
- tag/release;
- nuevas funcionalidades no justificadas;
- cambios sobre datos operativos.

======================================================================
FIN DEL BLOQUE 49 — PLAN DE FUNCIONALIDAD Y SOSTENIBILIDAD
======================================================================

REGLA DE CONTINUIDAD:

El próximo bloque del historial deberá ser:

50.

No reutilizar el número 49.
No reemplazar bloques anteriores.
Mantener la secuencia cronológica del historial.

======================================================================
BLOQUE 50 — CONSISTENCIA CONCURRENTE DE SNAPSHOT Y ROLLBACK
======================================================================

FECHA DE CIERRE: 2026-10-03

---------------------------------------------------------------------
50.1 DESCUBRIMIENTO
---------------------------------------------------------------------

Durante la auditoría previa al refactor de Reportes se identificó que el
mecanismo global de persistencia entregaba a saveSnapshot() referencias
vivas de reports, auditRecords y las demás colecciones de backupData().

La respuesta HTTP quedaba aplazada hasta terminar la persistencia, pero el
handler de una segunda solicitud mutante podía ejecutarse mientras la
primera persistencia continuaba pendiente.

Esto no era un defecto específico de Reportes. Afectaba el límite global de
snapshot, confirmación y rollback de todas las mutaciones persistidas.

---------------------------------------------------------------------
50.2 PRUEBA EMPÍRICA — PASO 0
---------------------------------------------------------------------

Se inyectó un repository completamente simulado y se forzó el rechazo de
saveSnapshot() durante el archivado de un reporte.

Resultado secuencial comprobado:

- respuesta HTTP 503;
- reports volvió exactamente al estado anterior;
- auditRecords volvió exactamente al estado anterior;
- no quedó una mutación parcial;
- una lectura posterior coincidió con la lectura previa;
- la identidad del arreglo reports se conservó mediante splice();
- los objetos internos fueron reemplazados por copias restauradas;
- MySQL operacional no fue utilizado.

---------------------------------------------------------------------
50.3 PRUEBA CONCURRENTE — PASO 0B
---------------------------------------------------------------------

Se ejecutaron dos PATCH de Reportes solapados y se controló manualmente la
resolución de cada saveSnapshot().

Sin la corrección se comprobó:

- ambos saveSnapshot() recibían la misma referencia de reports;
- ambos recibían la misma referencia de auditRecords;
- un snapshot pendiente cambiaba después de ser invocado;
- el rollback de una solicitud podía sobrescribir la mutación de otra;
- una solicitud podía responder HTTP 200 aunque su mutación desapareciera;
- memoria, auditoría, respuesta HTTP y persistencia podían divergir.

CASO OBSERVADO A CONFIRMA / B FALLA:

- A respondió 200;
- B respondió 503;
- A permaneció;
- el snapshot de A llegó a observar provisionalmente la mutación no
  confirmada de B.

CASO OBSERVADO A FALLA / B CONFIRMA:

- A respondió 503;
- B respondió 200;
- el rollback de A eliminó también la mutación de B;
- B quedó activo pese a que su respuesta afirmó que había sido archivado;
- la auditoría exitosa de B desapareció.

---------------------------------------------------------------------
50.4 CAUSA RAÍZ
---------------------------------------------------------------------

La condición de carrera combinaba cuatro factores:

1. backupData() devolvía objetos contenedores con referencias vivas.
2. saveSnapshot(backupData()) recibía esas referencias sin desacoplarlas.
3. Las solicitudes mutantes podían ejecutar sus handlers simultáneamente.
4. applyRestoredData(previous) restauraba globalmente todas las colecciones.

No existía una sección crítica que cubriera el ciclo completo desde la
captura de previous hasta commit o rollback.

---------------------------------------------------------------------
50.5 SOLUCIÓN IMPLEMENTADA
---------------------------------------------------------------------

Se agregó una cola privada por instancia de createProjectServer().

Se serializa exactamente el límite existente:

- repository disponible;
- URL bajo /api/;
- método POST, PATCH o DELETE.

La sección crítica ahora contiene:

adquirir turno
→ copiar previous
→ ejecutar handler
→ obtener respuesta provisional
→ copiar next
→ saveSnapshot(next)
→ commit o rollback
→ enviar respuesta definitiva
→ terminar respuesta
→ liberar turno

Las respuestas no exitosas restauran previous y no se persisten. Si el
handler lanza, se conserva la traducción HTTP existente y se restaura el
estado. Si saveSnapshot() falla, se restaura previous y se responde 503.

mutationTail absorbe internamente el rechazo de cada turno para que la cola
continúe procesando las operaciones siguientes.

---------------------------------------------------------------------
50.6 SNAPSHOTS DESACOPLADOS
---------------------------------------------------------------------

previous y next se crean mediante copia profunda JSON independiente.

El repository ya no recibe referencias vivas a:

- reports;
- auditRecords;
- usuarios;
- asistencia;
- formación;
- programas;
- excusas;
- demás colecciones del snapshot.

La prueba automática verificó expresamente:

- snapshot.reports !== reports interno;
- snapshot.audit !== auditRecords interno;
- el contenido de cada snapshot permaneció estable mientras estuvo
  pendiente.

---------------------------------------------------------------------
50.7 RESULTADOS DESPUÉS DE LA CORRECCIÓN
---------------------------------------------------------------------

CASO A CONFIRMA / B FALLA:

- A = HTTP 200;
- B = HTTP 503;
- solo A permanece archivado;
- solo permanece la auditoría de A;
- B no ejecuta su handler mientras A está pendiente.

CASO A FALLA / B CONFIRMA:

- A = HTTP 503;
- B = HTTP 200;
- solo B permanece archivado;
- solo permanece la auditoría de B;
- B comienza después del rollback completo de A.

También se verificó:

- ningún HTTP 200 corresponde a una mutación ausente;
- cada mutación exitosa coincide con un saveSnapshot() resuelto;
- una respuesta 4xx no envenena la cola;
- un rechazo de saveSnapshot() no envenena la cola;
- la operación válida siguiente continúa normalmente.

---------------------------------------------------------------------
50.8 CONFIRMACIÓN DE COMPATIBILIDAD JSON
---------------------------------------------------------------------

Se rastrearon las estructuras incluidas en backupData() y sus puntos de
creación y mutación.

Conclusión: COPIA PROFUNDA JSON SEGURA.

Justificación comprobada:

- las fechas persistidas se convierten a cadenas ISO;
- los Date usados para cálculo no entran en el snapshot;
- los Buffer de soportes se convierten a base64;
- Map y Set son estructuras temporales y no se almacenan;
- los números derivados persistidos están validados o protegidos contra
  divisiones sin datos;
- los campos opcionales persistidos se normalizan como cadenas, null o se
  omiten desde su origen;
- los datos MySQL proceden de columnas JSON;
- el estado legacy real fue recorrido recursivamente.

Escaneo del estado legacy real:

- 55 usuarios;
- 50 aprendices;
- 11.986 asistencias;
- 2 programas;
- 9 fichas;
- 6 horarios;
- 5 ambientes;
- 6 reportes;
- 4.996.134 bytes serializados;
- cero Date, undefined, NaN, Infinity, Buffer, Map, Set, ciclos, huecos de
  arreglo o prototipos especiales;
- round-trip JSON idéntico.

---------------------------------------------------------------------
50.9 CONFIRMACIÓN DEL MODO LEGACY
---------------------------------------------------------------------

Conclusión: SIN RIESGO CONCURRENTE EQUIVALENTE.

En Reportes, los await ocurren antes de la primera mutación, durante la
lectura del cuerpo. Después de mutar reports, persistReports() llama a
writeJsonFileAtomic(), que utiliza fs.writeFileSync() y fs.renameSync().

Entre la mutación, la escritura JSON, la auditoría y la respuesta no existe
ningún await ni otro punto de cesión al event loop. Otra solicitud no puede
intercalarse en esa sección dentro del proceso Node actual.

---------------------------------------------------------------------
50.10 VALIDACIÓN FINAL
---------------------------------------------------------------------

[OK] prueba específica de persistencia concurrente.
[OK] node --check servidor/servidor.js.
[OK] node --check pruebas/prueba_persistencia_concurrente.js.
[OK] npm test completo.
[OK] git diff --check.
[OK] MySQL operacional no utilizado por la prueba concurrente.
[OK] esquema y migraciones sin cambios.
[OK] Reportes, rutas, frontend y lógica de negocio sin refactor.

---------------------------------------------------------------------
50.11 COMMIT TÉCNICO
---------------------------------------------------------------------

HASH CORTO: 2726342

MENSAJE:

fix: serializar persistencia y proteger rollback concurrente

RESOLVIÓ:

- serialización global de mutaciones persistidas;
- snapshots previous y next estables;
- rollback aislado por turno;
- continuidad de la cola después de errores;
- prueba automática de los dos órdenes de confirmación y fallo.

ARCHIVOS:

- servidor/servidor.js;
- pruebas/prueba_persistencia_concurrente.js;
- package.json.

---------------------------------------------------------------------
50.12 RIESGO RESIDUAL DOCUMENTADO
---------------------------------------------------------------------

Las lecturas GET permanecen concurrentes. Una lectura puede observar
temporalmente una mutación en memoria que todavía no ha sido confirmada.

Este riesgo quedó explícitamente fuera de la corrección actual y no se
intentó resolver dentro de este bloque.

======================================================================
FIN DEL BLOQUE 50 — CONSISTENCIA CONCURRENTE CERRADA
======================================================================

======================================================================
51. ARQUITECTURA BACKEND — EXTRACCIÓN CONTROLADA DE REPORTES
======================================================================

ESTADO DEL BLOQUE: EN DESARROLLO.

---------------------------------------------------------------------
51.1 PASO 1 — ESTADO Y METADATOS DE REPORTES
---------------------------------------------------------------------

Se realizó la primera extracción arquitectónica de bajo riesgo desde
servidor/servidor.js hacia servidor/dominio/reportes.js.

RESPONSABILIDADES EXTRAÍDAS:

- normalización del estado mediante reportStatus();
- construcción de metadatos mediante reportMetadata();
- validación pura de las transiciones active / archived mediante
  validateReportTransition().

CONTRATOS CONSERVADOS:

- un estado distinto de archived continúa interpretándose como active;
- los metadatos conservan los mismos campos y valores por defecto;
- archive solo es válido desde active;
- restore solo es válido desde archived;
- la acción desconocida continúa produciendo HTTP 400;
- la transición incompatible continúa produciendo HTTP 409;
- los textos y cuerpos de las respuestas HTTP no cambiaron.

El mapeo de los resultados semánticos a HTTP 400/409 permanece en
servidor/servidor.js. No se movieron handlers completos ni se modificaron
persistencia, MySQL, PDF, auditoría, concurrencia, rutas o frontend.

---------------------------------------------------------------------
51.2 PRUEBA UNITARIA DEL DOMINIO
---------------------------------------------------------------------

Se añadieron casos unitarios a pruebas/prueba_modulos.js para comprobar:

- estado active por defecto;
- reconocimiento exacto de archived;
- forma completa de los metadatos activos y archivados;
- transiciones archive y restore válidas;
- acción inválida;
- archivado duplicado;
- restauración de un reporte activo;
- compatibilidad de reportes legacy sin status;
- ausencia de mutaciones sobre el objeto recibido.

---------------------------------------------------------------------
51.3 BÚSQUEDA DE COMPARACIONES DE ESTADO
---------------------------------------------------------------------

No quedaron comparaciones directas de report.status con active o archived
fuera de servidor/dominio/reportes.js.

En servidor/servidor.js permanece la condición
reportStatus(report) === "archived" dentro de la política de retención.
No duplica conceptualmente reportStatus(): consume la abstracción extraída
para seleccionar reportes archivados. Se dejó intacta por pertenecer a la
retención, fuera del alcance del Paso 1.

También permanecen en el handler las asignaciones report.status =
"archived" y report.status = "active" que aplican la transición ya
validada. No son comparaciones ni duplican la normalización de estado.

---------------------------------------------------------------------
51.4 VALIDACIÓN DEL PASO 1
---------------------------------------------------------------------

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] prueba unitaria del dominio mediante pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.
[OK] sin cambios en la corrección de concurrencia.
[OK] sin uso ni modificación de MySQL operacional.
[OK] sin cambios en migraciones, DB_NAME_TEST, frontend o rutas.

---------------------------------------------------------------------
51.5 COMMIT TÉCNICO DEL PASO 1
---------------------------------------------------------------------

HASH COMPLETO: d0bb011e42c18b8a0eb59e82c7ad82682c67d74c
HASH CORTO: d0bb011

MENSAJE:

refactor: extraer estado y metadatos de reportes

ARCHIVOS:

- servidor/dominio/reportes.js;
- servidor/servidor.js;
- pruebas/prueba_modulos.js.

COMMIT DOCUMENTAL:

HASH COMPLETO: f5209833be3bd38422849354518e8de971a047d5
HASH CORTO: f520983
FECHA Y HORA GIT: 2026-10-03 09:16:17 -0500
MENSAJE: docs: registrar paso 1 de arquitectura de reportes

RESULTADO:

PASO 1 CERRADO. BLOQUE 51 EN DESARROLLO.
No se hizo push y no se inició el Paso 2.

---------------------------------------------------------------------
51.6 PASO 2A — ARCHIVADO Y RESTAURACIÓN DE REPORTES
---------------------------------------------------------------------

Se extrajeron exclusivamente las mutaciones de archivado y restauración
desde servidor/servidor.js hacia servidor/dominio/reportes.js.

FUNCIONES INCORPORADAS:

- archiveReport(report, { archivedAt, archivedBy });
- restoreReport(report).

archiveReport() aplica exactamente:

- status = "archived";
- archivedAt = valor recibido;
- archivedBy = valor recibido.

restoreReport() aplica exactamente:

- status = "active";
- eliminación de archivedAt;
- eliminación de archivedBy.

Las funciones de dominio no conocen Date, sesión, HTTP, persistencia ni
auditoría. La generación de archivedAt y la resolución de archivedBy
permanecen en servidor.js.

ORDEN CONSERVADO EN servidor.js:

validar
→ capturar before
→ mutar mediante dominio
→ persistReports()
→ audit()
→ responder

También permanecen en servidor.js la autorización, búsqueda del reporte,
lectura HTTP, normalización de action, validateReportTransition(), códigos
HTTP, mensajes y construcción de la respuesta.

No se modificaron DELETE manual, retención, generación de reportes,
statisticsPayload(), createReportPdf(), MySQL, repositorio MySQL,
migraciones, DB_NAME_TEST, backupData(), applyRestoredData(),
deferResponseUntilMysqlCommit(), cola de concurrencia, rutas, frontend ni
infraestructura genérica de auditoría.

---------------------------------------------------------------------
51.7 PRUEBAS DEL PASO 2A
---------------------------------------------------------------------

Se ampliaron las pruebas unitarias del dominio para comprobar:

- transición active → archived;
- archivedAt exacto;
- archivedBy exacto;
- transición archived → active;
- eliminación de archivedAt;
- eliminación de archivedBy;
- compatibilidad de un reporte histórico sin status;
- conservación de todos los demás campos;
- metadatos before/after idénticos al comportamiento anterior.

REGRESIÓN EJECUTADA:

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] prueba unitaria de dominio mediante pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.

---------------------------------------------------------------------
51.8 COMMIT TÉCNICO DEL PASO 2A
---------------------------------------------------------------------

HASH COMPLETO: 63a320f44354e6880b67cea8093b38573f0aed0c
HASH CORTO: 63a320f

MENSAJE:

refactor: extraer mutaciones de archivo de reportes

ARCHIVOS:

- servidor/dominio/reportes.js;
- servidor/servidor.js;
- pruebas/prueba_modulos.js.

COMMIT DOCUMENTAL:

HASH COMPLETO: a6d25ed332e460e7ac4942171e99df9890a775fb
HASH CORTO: a6d25ed
FECHA Y HORA GIT: 2026-10-03 13:35:39 -0500
MENSAJE: docs: registrar paso 2A y hallazgo de retencion

---------------------------------------------------------------------
51.9 HALLAZGO PENDIENTE — ATOMICIDAD LEGACY DE RETENCIÓN
---------------------------------------------------------------------

El riesgo de atomicidad legacy detectado durante la auditoría afecta
exclusivamente al flujo de retención identificado.

- no afecta el diseño ni la implementación del Paso 2A;
- archivado y restauración conservan su orden actual de mutar,
  persistReports(), audit() y responder;
- el hallazgo no se considera solucionado por extraer funciones al dominio;
- deberá reevaluarse antes de implementar o cerrar el Paso 2C;
- al cerrar el Bloque 51 se decidirá si se resuelve dentro de 2C o pasa a
  un Bloque 52 independiente.

El hallazgo queda registrado como PENDIENTE. No se modificó la retención y
no se abrió el Bloque 52 porque el Bloque 51 continúa en desarrollo.

---------------------------------------------------------------------
51.10 ESTADO DEL BLOQUE
---------------------------------------------------------------------

PASO 2A CERRADO.
BLOQUE 51 EN DESARROLLO.
No se inició 2B ni 2C y no se hizo push.

---------------------------------------------------------------------
51.11 PASO 2B — ELIMINACIÓN MANUAL DE REPORTES
---------------------------------------------------------------------

Se extrajo la mecánica de eliminación manual desde servidor/servidor.js
hacia servidor/dominio/reportes.js mediante:

removeReport(reports, report)

Antes de definir el retorno se verificó el contrato real del Paso 2A:
archiveReport() y restoreReport() son comandos de dominio que mutan en sitio,
no realizan I/O y no devuelven un sobre de resultado con ok/reason ni datos
HTTP.

removeReport() conserva ese patrón de comando mutante y añade únicamente el
recibo mínimo que la eliminación necesita:

- si report no pertenece a reports, devuelve null y no modifica la colección;
- si la eliminación se realiza, devuelve { before, removed };
- before contiene reportMetadata(report) capturado antes de retirar el objeto;
- removed contiene la misma instancia retirada de la colección.

No se incorporaron códigos HTTP, sesión, persistencia ni auditoría al dominio.
No se creó el sobre conceptual { ok, reason, before, after, removed }, porque
2A no estableció ese estilo de retorno.

El handler conserva:

- autorización;
- búsqueda inicial por id;
- HTTP 404 cuando la búsqueda no encuentra el reporte;
- lectura y validación de confirm === true;
- persistReports();
- audit() con action = "delete";
- código HTTP 200 y mensaje existentes.

También conserva una comprobación defensiva del resultado null. Esta no
sustituye la búsqueda normal: bajo la cola, un segundo DELETE del mismo id
vuelve a ejecutar el handler, falla en la búsqueda inicial y no invoca
removeReport() con una referencia obsoleta.

---------------------------------------------------------------------
51.12 COBERTURA CONCURRENTE DE DELETE
---------------------------------------------------------------------

CASO A — DOS REPORTES DIFERENTES:

- estado inicial: reports = [A, B];
- DELETE A queda pendiente de confirmación del snapshot;
- DELETE B no inicia su handler hasta que A termina;
- al confirmar ambos snapshots, las respuestas son HTTP 200 y HTTP 200;
- se generan exactamente dos auditorías delete, una para A y otra para B;
- el estado final no contiene A ni B.

CASO B — DOS DELETE SOBRE EL MISMO REPORTE:

- estado inicial: reports = [A];
- el primer DELETE elimina A, persiste, audita y responde HTTP 200;
- el segundo DELETE comienza después de confirmarse el primero;
- la búsqueda normal del handler ya no encuentra A;
- el segundo DELETE responde HTTP 404 con el mensaje existente;
- no se solicita un segundo saveSnapshot();
- no se genera una segunda auditoría delete;
- el estado final permanece vacío y no se produce error interno.

La prueba unitaria también comprueba directamente el caso defensivo del
dominio: intentar eliminar un elemento que ya no pertenece a la colección
devuelve null y deja la colección intacta.

---------------------------------------------------------------------
51.13 VALIDACIÓN DEL PASO 2B
---------------------------------------------------------------------

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] prueba unitaria de dominio mediante pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.

---------------------------------------------------------------------
51.14 COMMIT TÉCNICO DEL PASO 2B
---------------------------------------------------------------------

HASH COMPLETO: 16c3ded1b8425b70a6bb8d9c5a421a143c2324f2
HASH CORTO: 16c3ded

MENSAJE:

refactor: extraer eliminacion de reportes

ARCHIVOS:

- servidor/dominio/reportes.js;
- servidor/servidor.js;
- pruebas/prueba_modulos.js;
- pruebas/prueba_persistencia_concurrente.js.

COMMIT DOCUMENTAL:

HASH COMPLETO: a064e05bad9938670c7e4174a65bbb7d9224ea85
HASH CORTO: a064e05
FECHA Y HORA GIT: 2026-10-03 13:42:52 -0500
MENSAJE: docs: registrar paso 2B de reportes

---------------------------------------------------------------------
51.15 RETENCIÓN Y HALLAZGO PENDIENTE
---------------------------------------------------------------------

RETENCIÓN MODIFICADA: NO.

HALLAZGO PENDIENTE — ATOMICIDAD LEGACY DE RETENCIÓN: PENDIENTE.

La extracción de removeReport() no modifica ni corrige el flujo actual de
retención. El hallazgo deberá reevaluarse antes de implementar o cerrar 2C,
tal como quedó establecido en 51.9.

---------------------------------------------------------------------
51.16 ESTADO DEL BLOQUE
---------------------------------------------------------------------

PASO 2B CERRADO.
BLOQUE 51 EN DESARROLLO.
No se inició 2C, no se abrió el Bloque 52 y no se hizo push.

---------------------------------------------------------------------
51.17 PASO 2C — RETENCIÓN SEGURA DE REPORTES
---------------------------------------------------------------------

La implementación aprobada para 2C fue B + D.

B — PREFLIGHT COMPLETO:

- se calcula required antes de mutar;
- se localizan únicamente reportes archivados;
- se ordenan por archivedAt || createdAt;
- se cierra la selección exacta de candidatos;
- se comprueba que candidates.length >= required;
- si no existen suficientes archivados se devuelve null sin llamar a
  removeReport(), sin splice(), push(), persistReports() ni audit().

D — PERSISTENCIA ANTES DE AUDITORÍA:

- todas las eliminaciones se aplican mediante removeReport();
- se agrega el nuevo reporte;
- se ejecuta una sola llamada a persistReports();
- después se registra retention_delete;
- después se registra create;
- finalmente se responde HTTP 201.

ORDEN IMPLEMENTADO:

preflight
→ aplicar todas las eliminaciones
→ agregar nuevo reporte
→ persistReports()
→ audit retention_delete
→ audit create
→ responder 201

Ninguna eliminación se persiste o audita individualmente. No existe una
auditoría dentro del bucle de eliminación.

---------------------------------------------------------------------
51.18 CONTRATO DEL DOMINIO DE RETENCIÓN
---------------------------------------------------------------------

Se incorporó en servidor/dominio/reportes.js:

pruneOldestArchivedReports(reports, limit)

CONTRATO:

- null: no existen suficientes archivados y la colección no fue modificada;
- []: la operación es factible y no requiere eliminaciones;
- [{ before, removed }, ...]: eliminaciones aplicadas en orden, reutilizando
  exactamente el recibo exitoso de removeReport().

La fase solo-lectura y la fase mutante están separadas. La selección se
completa antes del primer removeReport(). La función no conoce sesión, HTTP,
persistencia, auditoría, MySQL ni cola de concurrencia.

---------------------------------------------------------------------
51.19 PRUEBAS ESPECÍFICAS DE 2C
---------------------------------------------------------------------

FRONTERA 409:

- se necesitan 3 eliminaciones;
- solo existen 2 archivados y varios activos;
- la respuesta conserva HTTP 409 y el mensaje existente;
- reports queda exactamente igual;
- se observan cero splice() sobre la colección en la prueba de dominio;
- se observan cero llamadas a persistReports() en la prueba HTTP;
- no se genera retention_delete;
- no se genera audit create.

ORDEN DE EFECTOS:

La prueba instrumentada exige la secuencia exacta:

persistReports
→ retention_delete
→ create

No comprueba solamente presencia; compara el orden completo observado y
confirma que persistReports() se ejecuta una sola vez.

CONCURRENCIA:

- dos POST concurrentes quedan serializados por la cola MySQL existente;
- el segundo no inicia mientras el primer snapshot está pendiente;
- cada operación recalcula la retención sobre el estado confirmado;
- se eliminan los archivados en orden de antigüedad;
- ambos POST responden HTTP 201 al confirmarse sus snapshots;
- el límite y las auditorías permanecen consistentes.

ROLLBACK MYSQL:

- se rechaza un snapshot después de poda, creación y auditorías en memoria;
- la infraestructura MySQL existente restaura reportes y auditoría;
- la respuesta es HTTP 503;
- la cola continúa operativa con la solicitud siguiente.

---------------------------------------------------------------------
51.20 VALIDACIÓN DEL PASO 2C
---------------------------------------------------------------------

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] node --check pruebas/prueba_reportes.js.
[OK] node --check pruebas/prueba_persistencia_concurrente.js.
[OK] prueba unitaria de dominio mediante pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.

---------------------------------------------------------------------
51.21 COMMIT TÉCNICO DEL PASO 2C
---------------------------------------------------------------------

HASH COMPLETO: 369c0e0a6ea7778ceae76001f5c9c9ea3651ffcc
HASH CORTO: 369c0e0

MENSAJE:

refactor: extraer retencion segura de reportes

ARCHIVOS:

- servidor/dominio/reportes.js;
- servidor/servidor.js;
- pruebas/prueba_modulos.js;
- pruebas/prueba_reportes.js;
- pruebas/prueba_persistencia_concurrente.js.

---------------------------------------------------------------------
51.22 ALCANCE DE ATOMICIDAD LEGACY
---------------------------------------------------------------------

B corrige la infactibilidad previsible antes de cualquier mutación. Ya no
existe poda parcial seguida de HTTP 409.

D evita una auditoría retention_delete contradictoria cuando falla
persistReports(), porque la auditoría ocurre únicamente después de la
persistencia de la poda y de la creación.

E NO SE IMPLEMENTÓ EN 2C.

Por tanto:

- el rollback de reports en memoria ante un fallo legacy de persistReports()
  sigue NO resuelto;
- un fallo posterior de audit() sigue siendo una limitación legacy general;
- no se declara atomicidad completa entre memoria, archivo de reportes y
  auditoría;
- no se creó infraestructura transaccional general;
- no se modificaron MySQL, su repositorio, snapshots ni cola.

El hallazgo legacy queda parcialmente corregido y parcialmente pendiente.
El Bloque 52 NO se abre todavía.

---------------------------------------------------------------------
51.23 ESTADO DEL BLOQUE
---------------------------------------------------------------------

PASO 2C CERRADO.
BLOQUE 51 EN DESARROLLO.
No se abrió el Bloque 52 y no se hizo push.

---------------------------------------------------------------------
51.24 EVIDENCIA CRONOLÓGICA DE LOS COMMITS 2C
---------------------------------------------------------------------

1. COMMIT TÉCNICO

HASH COMPLETO: 369c0e0a6ea7778ceae76001f5c9c9ea3651ffcc
FECHA Y HORA GIT: 2026-10-03 14:01:11 -0500
MENSAJE: refactor: extraer retencion segura de reportes

2. COMMIT DOCUMENTAL

HASH COMPLETO: f2d2e3ffe3a629ae0b74f555f006dc854b0b22f5
FECHA Y HORA GIT: 2026-10-03 14:02:10 -0500
MENSAJE: docs: registrar paso 2C de reportes

Los dos commits quedan registrados en su orden cronológico real y uno debajo
del otro. No se reorganizó ni reemplazó contenido histórico anterior.

---------------------------------------------------------------------
51.25 PASO 3 — CONSTRUCCIÓN DEL SNAPSHOT DE REPORTES
---------------------------------------------------------------------

Se extrajo en servidor/dominio/reportes.js:

buildReportSnapshot(statistics, { id, createdAt, createdBy })

CONTRATO:

- conserva todos los campos del payload estadístico, incluido ok;
- incorpora id, createdAt y createdBy ya resueltos;
- establece status: "active";
- devuelve un objeto raíz nuevo;
- conserva las referencias anidadas existentes, igual que la expresión
  superficial anterior;
- no modifica el objeto statistics recibido.

El builder no calcula estadísticas, no genera UUID ni fecha, no conoce sesión,
HTTP, persistencia, auditoría, PDF, MySQL, repositorio, retención ni cola de
mutaciones.

En servidor/servidor.js se sustituyó únicamente la construcción inline del
reporte. El orden del flujo permanece:

requireStaff()
→ readJsonBody()
→ validar fechas
→ statisticsPayload()
→ validar distribución
→ retención Paso 2C
→ buildReportSnapshot()
→ reports.push()
→ persistReports()
→ retention_delete
→ create
→ HTTP 201

---------------------------------------------------------------------
51.26 VERIFICACIÓN DE statisticsPayload()
---------------------------------------------------------------------

CACHÉ: NO EXISTE.
MEMOIZACIÓN POR FECHAS O FILTROS: NO EXISTE.
PAYLOAD ALMACENADO Y REUTILIZADO: NO EXISTE.
OBJETO RAÍZ NUEVO POR LLAMADA: CONFIRMADO.
REFERENCIAS MUTABLES COMPARTIDAS ENTRE SOLICITUDES: NO EXISTEN.
MUTACIÓN POSTERIOR AL CÁLCULO ANTES DE PERSISTIR: NO EXISTE.

La comprobación siguió cada estructura mutable del payload:

- resolveDashboardRange() genera un arreglo periods nuevo;
- attendanceFichas() genera Map, objetos y arreglo nuevos;
- statusSummary() genera counts, percentages y objeto raíz nuevos;
- filter(), map(), Array.from(), los literales y nextSessions() generan las
  colecciones y objetos correspondientes por llamada;
- GET /api/statistics y POST /api/reports invocan statisticsPayload() por
  separado y no reciben la misma instancia;
- después de obtener payload, el POST solo valida distribution.total, ejecuta
  el preflight de retención y lo entrega al builder antes de persistir.

statisticsPayload() NO fue modificado. No se agregó structuredClone(), copia
JSON, Object.freeze() ni clon profundo.

---------------------------------------------------------------------
51.27 SEMÁNTICA DEL SNAPSHOT HISTÓRICO
---------------------------------------------------------------------

El reporte es un snapshot histórico porque conserva y persiste el payload
estadístico calculado en el momento de creación. Esto no significa que el
objeto JavaScript esté deep-frozen.

Se preservó exactamente la semántica superficial anterior: el snapshot tiene
raíz propia y mantiene las referencias anidadas del payload durante la misma
solicitud. No se introdujo una nueva garantía de inmutabilidad.

---------------------------------------------------------------------
51.28 PRUEBAS DEL PASO 3
---------------------------------------------------------------------

PRUEBA UNITARIA:

- conserva id, createdAt y createdBy exactos;
- establece status inicial active;
- conserva todos los campos del payload amplio real, incluido ok;
- no modifica statistics;
- devuelve una raíz distinta;
- conserva deliberadamente las referencias anidadas;
- recibe identidad, fecha y autor ya resueltos y no depende de sesión.

PRUEBAS DE INTEGRACIÓN Y REGRESIÓN:

[OK] POST /api/reports conserva HTTP 201 y metadatos.
[OK] El snapshot persistido conserva forma, ok e identidad.
[OK] Listado, detalle y PDF permanecen sin cambios.
[OK] Los archivados siguen descargables.
[OK] El histórico no cambia después de modificar asistencia.
[OK] La frontera de retención conserva HTTP 409 sin mutación.
[OK] El orden persistReports → retention_delete → create permanece.
[OK] La concurrencia MySQL sigue serializada.
[OK] El rollback MySQL sigue funcionando.

VALIDACIONES EJECUTADAS:

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] node --check pruebas/prueba_modulos.js.
[OK] node --check pruebas/prueba_reportes.js.
[OK] node --check pruebas/prueba_persistencia_concurrente.js.
[OK] prueba unitaria mediante node pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.

---------------------------------------------------------------------
51.29 COMMIT TÉCNICO DEL PASO 3
---------------------------------------------------------------------

HASH COMPLETO: d48e85319cee23f0e66c7f424bb49d98160bc5bf
HASH CORTO: d48e853
FECHA Y HORA GIT: 2026-10-03 23:59:37 -0500
MENSAJE: refactor: extraer construccion de snapshot de reportes

ARCHIVOS:

- servidor/dominio/reportes.js;
- servidor/servidor.js;
- pruebas/prueba_modulos.js;
- pruebas/prueba_reportes.js.

---------------------------------------------------------------------
51.30 RIESGOS RESIDUALES NO RESUELTOS
---------------------------------------------------------------------

1. LEGACY:
   si persistReports() falla después de mutar memoria, el rollback de memoria
   no está garantizado.

2. GET CONCURRENTE:
   una lectura puede observar temporalmente estado provisional antes de que
   una mutación MySQL quede confirmada.

Paso 3 no modificó ni declaró resueltos estos riesgos. La posible caché de
statisticsPayload() no se registra como riesgo porque la verificación confirmó
que no existe.

---------------------------------------------------------------------
51.31 ESTADO DEL PASO Y DEL BLOQUE
---------------------------------------------------------------------

PASO 3 CERRADO.
BLOQUE 51 LISTO PARA AUDITORÍA DE CIERRE.
No se abrió el Bloque 52 y no se hizo push.

---------------------------------------------------------------------
51.32 EVIDENCIA CRONOLÓGICA DE LOS COMMITS DEL PASO 3
---------------------------------------------------------------------

1. COMMIT TÉCNICO

HASH COMPLETO: d48e85319cee23f0e66c7f424bb49d98160bc5bf
HASH CORTO: d48e853
FECHA Y HORA GIT: 2026-10-03 23:59:37 -0500
MENSAJE: refactor: extraer construccion de snapshot de reportes

2. COMMIT DOCUMENTAL

HASH COMPLETO: 88c5ede36a0c8e33ec05e447610e2a8607163d0b
HASH CORTO: 88c5ede
FECHA Y HORA GIT: 2026-10-04 00:00:59 -0500
MENSAJE: docs: registrar paso 3 de arquitectura de reportes

Los dos commits quedan registrados con sus fechas y horas reales de Git. La
fecha cambia entre ambos porque se crearon a ambos lados de la medianoche en
America/Bogota (UTC-05:00).

=====================================================================
51.33 FIN DEL BLOQUE 51 — ARQUITECTURA BACKEND DE REPORTES CERRADA
=====================================================================

FECHA Y HORA DE CIERRE: 2026-10-04 00:08:51 -0500

ESTADO: CERRADO.

OBJETIVO ALCANZADO:

Reportes dispone de un dominio explícito y cohesivo. Las reglas de estado,
metadatos, transiciones, archivado, restauración, eliminación, retención y
construcción del snapshot dejaron de estar implementadas inline en el
coordinador HTTP. Estadísticas no fue duplicada: Reportes consume el payload
calculado por statisticsPayload(). No se introdujeron microservicios, capas de
repositorio nuevas ni infraestructura innecesaria.

PASOS CERRADOS:

- Paso 1: reportStatus(), reportMetadata() y validateReportTransition().
- Paso 2A: archiveReport() y restoreReport().
- Paso 2B: removeReport().
- Paso 2C: pruneOldestArchivedReports(), con preflight completo y orden de
  efectos persistReports() → retention_delete → create → HTTP 201.
- Paso 3: buildReportSnapshot(), conservando el payload estadístico completo,
  incluido ok, y agregando identidad, fecha, autor y estado inicial.

FUNCIONES FINALES DEL DOMINIO:

- buildReportSnapshot(): crea una raíz nueva sin mutar statistics; no realiza
  I/O.
- reportStatus(): normaliza el estado visible; no muta.
- reportMetadata(): proyecta metadatos; no muta.
- validateReportTransition(): valida archive/restore; no muta.
- archiveReport(): muta el reporte recibido a archived.
- restoreReport(): muta el reporte recibido a active y retira metadatos de
  archivo.
- removeReport(): muta la colección únicamente cuando contiene el reporte y
  devuelve null o { before, removed }.
- pruneOldestArchivedReports(): realiza preflight, selecciona archivados por
  archivedAt || createdAt y muta la colección solo si la poda completa es
  factible.

Ninguna función del dominio conoce request, response, estados HTTP, sesión,
persistReports(), audit(), PDF, MySQL, repository ni la cola global.

ARQUITECTURA RESULTANTE:

- servidor.js coordina autenticación, autorización, HTTP, lectura del body,
  cálculo estadístico, UUID/fecha/autor, llamadas al dominio, persistencia,
  auditoría y respuesta;
- dominio/reportes.js concentra las reglas cohesivas de Reportes;
- Reportes consume Estadísticas y no la reimplementa;
- el flujo histórico permanece statisticsPayload() → buildReportSnapshot() →
  reports → persistencia → detalle/PDF;
- el PDF recibe el snapshot persistido y no recalcula estadísticas.

CONTRATOS CONSERVADOS:

- HTTP, rutas, forma de persistencia, listado, detalle y PDF sin cambios;
- snapshot estable después de modificar asistencia y después de reiniciar;
- archivados descargables;
- 409 de retención sin mutaciones parciales;
- solo archivados se eliminan automáticamente, del más antiguo al más nuevo;
- una sola persistencia para poda más creación;
- mutaciones MySQL serializadas, snapshots desacoplados, rollback global y
  continuidad de la cola conservados.

REGRESIÓN FINAL:

[OK] node --check servidor/dominio/reportes.js.
[OK] node --check servidor/servidor.js.
[OK] node --check pruebas/prueba_modulos.js.
[OK] node --check pruebas/prueba_reportes.js.
[OK] node --check pruebas/prueba_persistencia_concurrente.js.
[OK] node pruebas/prueba_modulos.js.
[OK] npm run test:reports.
[OK] npm run test:persistence-concurrency.
[OK] npm test completo, código de salida 0.
[OK] git diff --check.

COMMITS PRINCIPALES:

La cadena técnica y documental de los Pasos 1, 2A, 2B, 2C y 3 fue comprobada
contra Git. Cada hash aparece en su sección cronológica correspondiente; los
commits de 2C y 3 conservan además sus apartados de evidencia conjunta. No se
añadieron duplicados durante esta auditoría al completar la cadena.

RIESGOS RESIDUALES CONOCIDOS:

1. MEMORIA LEGACY:
   si persistReports() falla después de mutar reports, el archivo puede
   conservar el estado previo mientras la memoria conserva estado provisional.
   El rollback local de memoria no está garantizado y no se declara atomicidad
   completa entre memoria, disco y auditoría.

2. GET PROVISIONAL:
   GET continúa fuera de la cola. Una lectura puede observar temporalmente
   estado provisional mientras una mutación MySQL espera commit o rollback.

DELIBERADAMENTE NO RESUELTO:

- no se añadió rollback legacy general;
- no se serializaron lecturas GET;
- no se añadió deep clone, Object.freeze() ni caché;
- no se modificaron Estadísticas, PDF, frontend, rutas, MySQL, migraciones,
  repositorio, formato de persistencia ni cola global;
- no se abrió el Bloque 52.

statisticsPayload() no cachea ni memoiza, produce una raíz nueva por llamada y
no comparte referencias mutables entre solicitudes. Por tanto, su posible
caché no se registra como riesgo residual.

REGLA DE REAPERTURA:

El Bloque 51 no debe reabrirse sin evidencia técnica nueva y reproducible. Los
dos riesgos residuales conocidos, por sí solos, no obligan a abrir Bloque 52.

BLOQUE 51 — ESTADO FINAL: CERRADO.
No se abrió el Bloque 52 y no se hizo push.
