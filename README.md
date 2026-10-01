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
