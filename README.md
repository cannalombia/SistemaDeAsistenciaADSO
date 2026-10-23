<div align="center">

<img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Logosimbolo_SENA_2022.svg" alt="Logo SENA" width="125">

<h1><strong>Sistema de Asistencia SENA</strong></h1>

<h3>Sistema web de gestión y control de asistencia</h3>

<p><strong>Análisis y Desarrollo de Software — ADSO</strong></p>

<p>Node.js · MySQL · HTML · CSS · JavaScript · Git</p>

</div>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                          DESCRIPCIÓN DEL PROYECTO                                          -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El <strong>Sistema de Asistencia SENA</strong> es una aplicación web desarrollada para centralizar la gestión de usuarios, programas de formación, fichas, horarios, ambientes y registros de asistencia.
El sistema integra una interfaz web, un servidor Node.js y una base de datos MySQL. También incorpora autenticación por roles, asistencia manual y mediante QR, estadísticas, reportes PDF, auditoría, excusas, respaldos y recuperación controlada.
Su objetivo es facilitar el registro, consulta y seguimiento de la asistencia dentro de un entorno de formación.
<strong>Nota:</strong> este repositorio corresponde a un proyecto académico desarrollado en el programa de Análisis y Desarrollo de Software. No representa una plataforma oficial del SENA.

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                            ESTADO DEL PROYECTO                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Componente	Estado
Interfaz web	Operativa
Servidor Node.js	Operativo
Persistencia MySQL	Activa
Gestión de usuarios	Operativa
Programas y fichas	Operativos
Horarios y ambientes	Operativos
Control de asistencia	Operativo
Asistencia mediante QR	Implementada
Excusas y justificaciones	Implementadas
Estadísticas	Operativas
Reportes PDF	Operativos
Auditoría	Implementada
Backup y restauración	Implementados
Pruebas automatizadas	Disponibles


La persistencia operacional utiliza:
<pre>
DATA_SOURCE=mysql
</pre>

Los archivos CSV y JSON se conservan únicamente como respaldo legacy o material de recuperación.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                            ARQUITECTURA GENERAL                                            -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El proyecto separa la interfaz, la lógica del servidor y la persistencia de datos.
<pre>
Usuario
   |
   v
Interfaz web
   |
   v
Servidor Node.js / API
   |
   v
Reglas de negocio
   |
   v
MySQL 8.4 LTS
</pre>

Esta separación facilita el mantenimiento del sistema y evita mezclar las responsabilidades de presentación, lógica y almacenamiento.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                          ESTRUCTURA DEL PROYECTO                                           -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Carpeta	Responsabilidad
aplicacion/	Interfaz y funciones visibles
servidor/	API, autenticación y reglas del sistema
servidor/rutas/	Endpoints organizados por funcionalidad
pruebas/	Pruebas automatizadas
documentacion/	Guías, arquitectura y procedimientos
datos/	Archivos legacy y respaldos controlados


Mapa completo:
<a href="Estructura.txt">Estructura.txt</a>
Guía para la sustentación:
<a href="documentacion/guias/presentacion_proyecto.md">Presentación del proyecto</a>
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                           TECNOLOGÍAS UTILIZADAS                                           -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Área	Tecnología
Frontend	HTML, CSS y JavaScript
Backend	Node.js
Base de datos	MySQL 8.4 LTS
Control de versiones	Git
Repositorio remoto	GitHub
Documentos	PDF
Entorno principal	Windows


<hr>

<pre><strong>
**********************************************************************************************************************
** --                                             ROLES DEL SISTEMA                                              -- **
**********************************************************************************************************************
</strong></pre>

<hr>

<strong>Administrador</strong>
Gestiona la configuración general, usuarios, formación, respaldos y operaciones administrativas.
<strong>Coordinador</strong>
Consulta y administra información académica según los permisos asignados.
<strong>Instructor</strong>
Gestiona fichas, aprendices y registros de asistencia.
<strong>Aprendiz</strong>
Consulta su información, asistencia y funciones habilitadas para su perfil.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                            GESTIÓN DE USUARIOS                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El sistema permite:
- Crear usuarios.
- Consultar usuarios.
- Modificar información.
- Buscar y filtrar registros.
- Activar y desactivar usuarios.
- Importar información.
- Controlar permisos de acuerdo con el rol.
La información operacional se almacena en MySQL.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                        PROGRAMAS, FICHAS Y HORARIOS                                        -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El módulo de formación permite administrar:
- Programas de formación.
- Fichas.
- Aprendices asociados.
- Horarios.
- Ambientes.
- Estados.
- Relaciones académicas.
Las relaciones se almacenan en MySQL y utilizan reglas de integridad para reducir inconsistencias.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                           CONTROL DE ASISTENCIA                                            -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El sistema permite registrar estados como:
- Presente.
- Ausente.
- Tardanza.
- Justificación.
También dispone de corrección controlada de registros.
Información de la corrección	Registro
Estado anterior	Sí
Estado nuevo	Sí
Motivo	Sí
Usuario responsable	Sí
Fecha y hora	Sí
Auditoría	Sí


<hr>

<pre><strong>
**********************************************************************************************************************
** --                                           ASISTENCIA MEDIANTE QR                                           -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El sistema incorpora un mecanismo de asistencia mediante código QR temporal.
<pre>
Instructor
    |
    v
Selecciona ficha y jornada
    |
    v
Genera código QR
    |
    v
Aprendiz escanea
    |
    v
Servidor valida el token y la ficha
    |
    v
Confirma asistencia
    |
    v
Registro guardado en MySQL
</pre>

Los códigos utilizan tokens temporales para reducir su reutilización fuera del periodo permitido.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                         EXCUSAS Y JUSTIFICACIONES                                          -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Los aprendices pueden registrar soportes relacionados con ausencias.
<pre>
PENDIENTE  ->  APROBADA
           ->  RECHAZADA
</pre>

Los usuarios autorizados pueden revisar cada solicitud y registrar una decisión. Una excusa aprobada puede justificar la ausencia correspondiente.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                ESTADÍSTICAS                                                -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El módulo de estadísticas permite consultar información mediante:
- Ficha.
- Fecha inicial.
- Fecha final.
El sistema genera indicadores y detalle de asistencia usando los registros almacenados en MySQL. Los días sin registro no se convierten automáticamente en ausencias.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                  REPORTES                                                  -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El sistema permite generar y conservar reportes históricos.
Desde <strong>Reportes guardados</strong> se puede:
- Buscar informes.
- Consultar detalles.
- Revisar cortes históricos.
- Descargar archivos PDF.
Los reportes guardados permanecen almacenados en MySQL.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                              EXPORTACIÓN PDF                                               -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Para generar un informe:
1. Selecciona la ficha.
2. Selecciona la fecha.
3. Selecciona la jornada.
4. Guarda los cambios.
5. Pulsa <strong>Exportar PDF</strong>.
La biblioteca utilizada para generar los documentos se encuentra localmente en:
<pre>
servidor/vendor
</pre>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                             PERSISTENCIA MYSQL                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

MySQL es la fuente operacional principal del sistema.
La arquitectura incluye:
- Base de datos principal.
- Base de datos independiente para pruebas.
- Usuario de aplicación.
- Usuario de migraciones.
- Claves foráneas e índices.
- Migraciones versionadas.
- Transacciones.
- Validación de integridad.
- Backup y restauración.
- Health check.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                          COMPROBACIÓN DE LA BASE                                           -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El servidor dispone del endpoint:
<pre>
/api/health
</pre>

El estado correcto debe indicar:
<pre>
database.source=mysql
database.ready=true
</pre>

Esto confirma que el servidor está utilizando MySQL correctamente.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                DATOS LEGACY                                                -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Archivos como <strong>usuarios_listo_para_importar.csv</strong> y determinados JSON ubicados en datos/ se conservan únicamente como respaldo, referencia histórica o recuperación controlada.
No representan la fuente operacional activa.
<a href="documentacion/guias/cierre_tecnico_mysql.md">Cierre técnico MySQL</a>
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                 REQUISITOS                                                 -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Requisito	Versión
Windows	10 u 11
Node.js	18 o superior
npm	Incluido con Node.js
MySQL	8.4 LTS


También se requiere una base principal, una base de pruebas, usuarios MySQL de aplicación y migración, y un archivo .env configurado localmente.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                INSTALACIÓN                                                 -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Abre PowerShell dentro de la carpeta del proyecto.
Instalar dependencias:
<pre>
npm.cmd install
</pre>

Crear el archivo local de configuración:
<pre>
Copy-Item .env.example .env
</pre>

Después completa las variables necesarias dentro de .env.
<strong>Importante:</strong> .env contiene información privada y no debe subirse a GitHub.

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                             INICIAR EL SISTEMA                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

<strong>Opción recomendada en Windows</strong>
<a href="ABRIR_PROYECTO.cmd">ABRIR_PROYECTO.cmd</a>
Este archivo comprueba el servidor y abre automáticamente la pantalla de ingreso.
<strong>Desde PowerShell</strong>
<pre>
npm.cmd start
</pre>

Después abre:
http://localhost:3000/login.html
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                             VISUAL STUDIO CODE                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Abre la carpeta completa del proyecto en Visual Studio Code.
Presiona:
<pre>
F5
</pre>

Selecciona:
<strong>Abrir Sistema de Asistencia SENA</strong>
No se recomienda utilizar <strong>Go Live</strong>, porque el proyecto necesita Node.js para ejecutar la API, autenticación, MySQL y servicios de correo.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                             CORREO ELECTRÓNICO                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El sistema puede utilizar correo electrónico para códigos de acceso y notificaciones.
La configuración permanece fuera del código mediante variables de entorno.
<a href="documentacion/guias/2026-08-21_configurar_correo.md">Configuración de correo</a>
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                               ADMINISTRADOR                                                -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Desde <strong>Configuración</strong> se puede actualizar:
- Nombre.
- Correo.
- Contraseña.
Para restablecer la contraseña administrativa desde el equipo local:
<pre>
npm.cmd run reset:admin
</pre>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                  PRUEBAS                                                   -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Después de realizar cambios importantes:
<pre>
npm.cmd test
</pre>

Una ejecución satisfactoria debe finalizar con:
<pre>
OK
</pre>

Pruebas unitarias:
<pre>
npm.cmd run test:unit
</pre>

Pruebas de integración:
<pre>
npm.cmd run test:integration
</pre>

Pruebas de reportes:
<pre>
npm.cmd run test:reports
</pre>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                          MANTENER SERVIDOR ACTIVO                                          -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Instalar el mecanismo automático:
<pre>
npm.cmd run install:autostart
</pre>

Consultar estado:
<pre>
npm.cmd run status
</pre>

Comprobar o iniciar el servidor:
<pre>
npm.cmd run start:ensure
</pre>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                 SEGURIDAD                                                  -- **
**********************************************************************************************************************
</strong></pre>

<hr>

La información sensible permanece fuera del repositorio.
No deben publicarse:
- .env
- Contraseñas.
- Claves MySQL.
- Tokens.
- API keys.
- Secretos.
- Claves de correo.
- Logs privados.
- Backups operativos.
- Dumps con información privada.
Las credenciales integradas directamente en el código fueron retiradas y sustituidas por configuración local o variables de entorno.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                GIT Y GITHUB                                                -- **
**********************************************************************************************************************
</strong></pre>

<hr>

El proyecto utiliza Git para mantener trazabilidad de su evolución.
<strong>Repositorio</strong>
<pre>
SistemaDeAsistenciaADSO
</pre>

<strong>Rama principal</strong>
<pre>
main
</pre>

Git permite conservar evidencia de nuevas funcionalidades, correcciones, refactorizaciones, cambios de seguridad, arquitectura y documentación.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                         FLUJO PARA NUEVOS CAMBIOS                                          -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Revisar el estado:
<pre>
git status
</pre>

Agregar cambios:
<pre>
git add .
</pre>

Crear un commit:
<pre>
git commit -m "descripcion del cambio"
</pre>

Subir a GitHub:
<pre>
git push
</pre>

Comprobar sincronización:
<pre>
git status -sb
</pre>

<hr>

<pre><strong>
**********************************************************************************************************************
** --                                           DOCUMENTACIÓN TÉCNICA                                            -- **
**********************************************************************************************************************
</strong></pre>

<hr>

Documento	Contenido
<a href="Estructura.txt">Estructura.txt</a>	Mapa general
<a href="documentacion/guias/presentacion_proyecto.md">Presentación</a>	Guía para sustentación
<a href="documentacion/arquitectura/2026-08-22_arquitectura_actual.md">Arquitectura</a>	Diseño técnico
<a href="documentacion/arquitectura/2026-08-22_flujo_de_calidad.md">Flujo de calidad</a>	Proceso de desarrollo
<a href="documentacion/guias/2026-08-21_configurar_correo.md">Configuración de correo</a>	Servicio de correo
<a href="documentacion/guias/cierre_tecnico_mysql.md">Cierre MySQL</a>	Persistencia y recuperación
<a href="documentacion/guias/acceso_publico_ssh.md">Acceso público</a>	Acceso temporal
<a href="documentacion/guias/importacion_sql.md">Importación SQL</a>	Formato integral, validación y restauración


<hr>

<pre><strong>
**********************************************************************************************************************
** --                                            GITHUB Y DESPLIEGUE                                             -- **
**********************************************************************************************************************
</strong></pre>

<hr>

GitHub se utiliza para:
- Almacenar el código.
- Mantener commits.
- Conservar el historial.
- Respaldar el proyecto.
- Documentar su evolución.
GitHub Pages no ejecuta directamente este sistema completo porque la aplicación necesita Node.js, MySQL, API, variables de entorno y servicios de correo.
Para disponer de un enlace público permanente es necesario desplegar el backend y la base de datos en una infraestructura compatible.
<hr>

<pre><strong>
**********************************************************************************************************************
** --                                                FLUJO RÁPIDO                                                -- **
**********************************************************************************************************************
</strong></pre>

<hr>

<pre>
1. Instalar dependencias
          |
          v
2. Configurar .env
          |
          v
3. Verificar MySQL
          |
          v
4. Iniciar Node.js
          |
          v
5. Abrir el login
          |
          v
6. Utilizar el sistema
          |
          v
7. Ejecutar pruebas
</pre>

Comandos principales:
<pre>
npm.cmd install
npm.cmd start
npm.cmd test
</pre>

<hr>

<div align="center">

<pre><strong>
**********************************************************************************************************************
** --                                         SISTEMA DE ASISTENCIA SENA                                         -- **
**********************************************************************************************************************
</strong></pre>

<strong>Análisis y Desarrollo de Software — ADSO</strong>
Sistema web de gestión y control de asistencia
<strong>Repositorio: SistemaDeAsistenciaADSO</strong>
</div>


## Resiliencia final 2026-10-12

Build: `2026-10-12-final-resilience-r1`.

Esta versión incorpora health checks `live/ready/full`, cierre ordenado, supervisor con protección de crash-loop, sesiones y QR compartidos en MySQL, lock distribuido para mutaciones, revisión de estado, idempotencia, outbox/circuit breaker de correo y archivos de ejemplo para dos instancias Node detrás de HAProxy/Nginx.

Después de actualizar una instalación MySQL existente, ejecutar `npm run db:migrate` antes de iniciar el servidor. La guía completa está en `documentacion/CIERRE_FINAL_RESILIENCIA_BLUE_MAGIC_20261012.md`.

## Biometría real — DigitalPersona U.are.U 4500

Build biométrico: `version-8.9.1-biosecure-premium-motion-20261019` (actualización de la 8.5).

La integración admite hardware real sin el SDK comercial de HID usando WSL2,
Ubuntu 24.04, usbipd-win y libfprint. Desde **Crear usuario** se accede
al flujo único de enrolamiento **huella_registro.html**, con confirmación de autorización documentada.
La plantilla se almacena como plantilla cifrada AES-256-GCM y la pantalla de **Asistencia >
Huella digital** identifica contra los aprendices enrolados de la ficha. Una
identificación válida genera un ticket de 15 segundos y de un solo uso para
registrar `presente` por huella.

Preparación inicial en el PC:

```text
1. Conectar DigitalPersona 4500.
2. Confirmar que usbipd list muestra 05ba:000a como Shared.
3. Ejecutar puente_biometrico_real\INSTALAR_BIOMETRIA_REAL.cmd una sola vez.
4. Ejecutar ABRIR_PROYECTO.cmd normalmente.
```

El modo `mock` permanece disponible como fallback. Consulta `docs/biometria.md`.

### Diagnóstico biométrico real

Con el DigitalPersona conectado puedes validar toda la cadena sin mostrar secretos:

```powershell
npm run doctor:biometria
```

El puerto del puente se toma de `BIOMETRIC_SERVICE_URL` (por defecto `http://127.0.0.1:4318`) y el supervisor usa automáticamente el mismo valor para Node, mock y puente real.


## Actualización 8.9.1 (19/10/2026)

- Enrolamiento centralizado: búsqueda por nombre/documento/ficha, reconexión del lector, confirmación explícita de autorización y progreso derivado de capturas reales.
- Consola biométrica premium, con estados de hardware y adaptación responsive, modo oscuro y `prefers-reduced-motion`.
- Corrección del guardado: el backend confirma la persistencia de la plantilla antes de marcarla como finalizada.
- Cancelación del puente: conserva el bloqueo del dispositivo hasta que termine el proceso físico anterior.
- Bloqueo de API biométrica desde URLs públicas/LAN: operar desde `http://localhost:3000` o `http://127.0.0.1:3000` en el PC del lector. Otras funcionalidades mantienen sus rutas originales.
- Suite adicional de pruebas de contrato Python (sin hardware) y verificación de seguridad local.
- ZIP de distribución sin `.env`, copias con claves, datos operativos, plantillas, credenciales ni `node_modules`. Incluye `package-lock.json` para `npm ci`.

**Validación física pendiente:** se necesitan un dispositivo DigitalPersona conectado por USB a WSL2 y un aprendiz de prueba autorizado para registrar, verificar e identificar una huella. Las pruebas automáticas NO sustituyen esa verificación.

Para actualizar una instalación existente: haz una copia de seguridad; conserva **tu `.env` original** (sobre todo `BIOMETRIC_ENCRYPTION_KEY`) y sus datos cifrados originales de forma privada; extrae la 8.9 en una carpeta nueva, copia solo los datos y configuraciones necesarios bajo tu control y ejecuta `npm ci`. No elimines ni generes otra clave de cifrado si necesitas recuperar plantillas antiguas.

Documentación detallada: `docs/BIOMETRIA_VERSION_8_9.md`.


## BioSecure SENA 9.1 (21-10-2026)

- Desde **Estadísticas e informes** el administrador dispone de **Registrar huella** y de un resumen de registros de enrolamiento. El resumen no expone datos biométricos, solo conteos y el modo REAL/MOCK.
- La API `GET /api/biometria/resumen` exige sesión de administrador y acceso desde localhost; los instructores y usuarios remotos no pueden consultar el resumen ni abrir desde allí los controles administrativos.
- **Asistencia por huella** sigue en su módulo anterior; no se duplica el enrolamiento ni se crea una plantilla desde Estadísticas. La captura continúa exigiendo consentimiento documentado y el lector conectado.
- Para abrir la **demostración visual** sin base de datos utiliza `ABRIR_DEMO_LOCAL.cmd`. Es independiente del inicio operativo `ABRIR_PROYECTO.cmd` y no verifica biometría real ni sustituye MySQL.
- Para el funcionamiento real utiliza tu propio `.env` privado, MySQL, migraciones y el puente local WSL2/libfprint. Consulta `docs/BIOSECURE_VERSION_9_1.md`. **No copies las claves ni plantillas en Git o al ZIP.**

## Planeacion GitHub / tablero / historia HID

El desarrollo se gestiona con historias INVEST, criterios `Dado / cuando / entonces`, issues y un tablero publico. La trazabilidad vigente esta en:

- [Backlog BioSecure 9.1](planeacion/backlog.md)
- [Incidencias verificadas](planeacion/incidencias.md)
- [Flujo permanente de trabajo](planeacion/flujo_de_trabajo.md)
- [Historial verificable del 16 al 23 de octubre](planeacion/historial_16_al_21_octubre.md)
- [Entrega Git/GitHub II](ENTREGA.md)
- [Issues del repositorio](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues)
- [Tablero publico BioSecure HID](https://github.com/users/cannalombia/projects/1)

Antes de publicar una tarea, ejecuta:

```powershell
node verificar-plan.js
git status -sb
git diff --cached --check
```

La historia HID no se declara terminada por detectar el lector. La homologacion requiere captura autorizada, identificacion, registro unico en MySQL y una repeticion despues de reiniciar WSL2.

### Evidencia real del 16 al 23 de octubre de 2026

- Del 16 al 20 no hay commits publicados. La bitacora separa expresamente la cronologia inferida y los documentos importados el 21; no se presentan como actividad Git historica.
- El 21 se publicaron la integracion BioSecure 9.1 (`a789cd9`) y la planeacion GitHub (`df9dcb1`). El lector `05ba:000a`, WSL2, `lsusb`, `fprintd`, el puente `:4318` y Node `:3000` quedaron documentados, junto con el limite de la prueba fisica.
- El 22 se publicaron cuatro commits reales de preparacion para produccion: `63f299e`, `edb33c8`, `fc6bdb4` y `1bde09e`.
- El 23 se documentaron y verificaron localmente [BUG-04 #12](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/12) y [BUG-05 #13](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/13) de modo oscuro. Sus cambios no se declaran publicados mientras no exista un commit que los relacione y llegue a GitHub.
- [#4](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/4) permanece abierto por la asistencia fisica y MySQL. [#8](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/8) permanece abierto por la prueba posterior al reinicio de WSL2. [#11](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/11) concentra este cierre documental.
