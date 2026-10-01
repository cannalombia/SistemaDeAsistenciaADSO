<div align="center">

<img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Sena_Colombia_logo.svg" alt="Logo SENA" width="110">

<pre>
******************************************************
       ** --  SISTEMA DE ASISTENCIA SENA  -- **       
******************************************************
</pre>


<pre>-- GESTIÓN DE USUARIOS, FORMACIÓN Y CONTROL DE ASISTENCIA --</pre>

Proyecto académico desarrollado para administrar usuarios, programas, fichas, horarios, ambientes y asistencia.
</div>

<pre>
******************************************************
              ** --  DESCRIPCIÓN  -- **               
******************************************************
</pre>

Sistema de Asistencia SENA es una aplicación web orientada al control de usuarios, programas de formación, fichas, horarios, ambientes y registros de asistencia.
El sistema integra una interfaz web, un servidor Node.js y una base de datos MySQL. También permite el ingreso de aprendices mediante códigos enviados al correo electrónico y dispone de herramientas para consultar estadísticas, generar informes y conservar el historial de asistencia.
Nota: este repositorio corresponde a un proyecto académico y no representa una plataforma oficial del SENA.

<pre>
******************************************************
          ** --  ESTADO DEL PROYECTO  -- **           
******************************************************
</pre>

- Interfaz web operativa.
- Servidor Node.js operativo.
- Persistencia MySQL activa.
- Migraciones completadas.
- Validación posterior a migración aprobada.
- Pruebas automatizadas disponibles.
- CSV y JSON conservados solo como respaldo legacy.
La fuente activa de datos es:
DATA_SOURCE=mysql
Los archivos CSV y JSON se conservan únicamente como respaldo o referencia histórica. No son la persistencia operacional activa.
<pre>
******************************************************
           ** --  ESTRUCTURA GENERAL  -- **           
******************************************************
</pre>

El proyecto está dividido en áreas principales:
- aplicacion/: interfaz del usuario.
- servidor/: API, reglas de negocio, autenticación y persistencia.
- pruebas/: verificaciones del sistema.
- documentacion/: guías, arquitectura y soporte técnico.
- datos/: archivos legacy y referencias controladas.
Para revisar el mapa completo:
[`Estructura.txt`](Estructura.txt)
Para preparar la exposición:
[Guía de presentación del proyecto](documentacion/guias/presentacion_proyecto.md)
<pre>
******************************************************
               ** --  REQUISITOS  -- **               
******************************************************
</pre>

Antes de ejecutar el proyecto se necesita:
- Windows 10 u 11
- Node.js 18 o posterior
- npm
- MySQL 8.4 LTS
También deben existir:
- base de datos principal;
- base de datos de pruebas;
- cuenta de aplicación con permisos mínimos;
- cuenta separada para migraciones;
- archivo .env configurado localmente.
<pre>
******************************************************
              ** --  INSTALACIÓN  -- **               
******************************************************
</pre>

Desde PowerShell, dentro de la carpeta del proyecto:
npm.cmd install
Copy-Item .env.example .env
Después completa las variables requeridas dentro de .env.
.env contiene información privada y no debe subirse a GitHub.

Una vez configurado:
npm.cmd start
<pre>
******************************************************
        ** --  CÓMO INICIAR EL SISTEMA  -- **         
******************************************************
</pre>


<pre>-- OPCIÓN RECOMENDADA EN WINDOWS --</pre>

Haz doble clic en:
[`ABRIR_PROYECTO.cmd`](ABRIR_PROYECTO.cmd)
Este acceso comprueba el estado del servidor y abre la pantalla de ingreso en el navegador.
<pre>-- DESDE LA TERMINAL --</pre>

npm.cmd start
Luego abre:
http://localhost:3000/login.html
<pre>-- DESDE `INDEX.HTML` --</pre>

También puedes abrir:
[`index.html`](index.html)
y seleccionar Abrir el proyecto.
Si Windows intenta abrirlo como código, abre el archivo con Chrome o Edge.
<pre>
******************************************************
    ** --  ACCESO DESDE VISUAL STUDIO CODE  -- **     
******************************************************
</pre>

Abre la carpeta completa del proyecto en Visual Studio Code.
Presiona:
F5
y selecciona:
Abrir Sistema de Asistencia SENA
No uses Go Live, porque este proyecto necesita el servidor Node.js para autenticación, API, persistencia y correo.

Si el servidor todavía no está iniciado:
npm.cmd start
<pre>
******************************************************
           ** --  PERSISTENCIA MYSQL  -- **           
******************************************************
</pre>

MySQL es la persistencia operacional principal del sistema.
La configuración activa debe utilizar:
DATA_SOURCE=mysql
El sistema cuenta con:
- base principal;
- base de pruebas;
- cuenta de aplicación con permisos mínimos;
- cuenta de migraciones;
- migraciones versionadas;
- validación de estructura;
- mecanismo de respaldo y recuperación.
<pre>-- COMPROBAR CONEXIÓN --</pre>

El estado de la base se consulta en:
/api/health
La respuesta debe indicar:
database.source=mysql
database.ready=true
<pre>-- DATOS LEGACY --</pre>

Archivos como usuarios_listo_para_importar.csv y los JSON ubicados en datos/ se conservan únicamente como respaldo o recuperación.
No deben editarse esperando modificar los datos activos del sistema.
Para cierre técnico y recuperación:
[Guía de cierre técnico MySQL](documentacion/guias/cierre_tecnico_mysql.md)
<pre>
******************************************************
             ** --  ADMINISTRADOR  -- **              
******************************************************
</pre>

Desde Configuración, la cuenta administrativa puede actualizar:
- nombre;
- correo;
- contraseña.
Si se necesita restablecer la contraseña administrativa desde el equipo local:
npm.cmd run reset:admin
El procedimiento conserva el nombre y el correo configurados.
<pre>
******************************************************
        ** --  ESTADÍSTICAS E INFORMES  -- **         
******************************************************
</pre>


<pre>-- ESTADÍSTICAS --</pre>

Desde Estadísticas se puede seleccionar:
- ficha;
- fecha inicial;
- fecha final.
El panel actualiza los indicadores y el detalle de asistencia según los filtros seleccionados.
<pre>-- INFORMES GUARDADOS --</pre>

La opción Generar y guardar permite conservar un corte de información dentro del historial.
Desde Reportes guardados es posible:
- buscar informes;
- consultar el detalle;
- descargar PDF;
- conservar el corte histórico aunque posteriormente cambie la asistencia.
Los informes se almacenan en MySQL.
<pre>-- EXPORTACIÓN DESDE ASISTENCIA --</pre>

Desde Asistencia:
1. guarda primero los cambios;
2. selecciona ficha, fecha y jornada;
3. pulsa Exportar PDF.
<pre>-- BIBLIOTECA PDF --</pre>

La biblioteca utilizada para producir los documentos se encuentra incluida localmente en:
servidor/vendor
<pre>
******************************************************
                ** --  PRUEBAS  -- **                 
******************************************************
</pre>

Después de realizar cambios:
npm.cmd test
Una ejecución satisfactoria debe finalizar con:
OK
También se pueden ejecutar grupos específicos:
<pre>-- PRUEBAS UNITARIAS --</pre>

npm.cmd run test:unit
<pre>-- PRUEBAS DE INTEGRACIÓN --</pre>

npm.cmd run test:integration
<pre>-- PRUEBAS DE REPORTES --</pre>

npm.cmd run test:reports
<pre>
******************************************************
      ** --  MANTENER EL SERVIDOR ACTIVO  -- **       
******************************************************
</pre>

El proyecto incluye un mecanismo de supervisión para Windows.
<pre>-- INSTALAR INICIO AUTOMÁTICO --</pre>

npm.cmd run install:autostart
<pre>-- CONSULTAR ESTADO --</pre>

npm.cmd run status
<pre>-- COMPROBAR O INICIAR MANUALMENTE --</pre>

npm.cmd run start:ensure
<pre>
******************************************************
       ** --  SEGURIDAD Y DATOS PRIVADOS  -- **       
******************************************************
</pre>

La configuración privada debe permanecer fuera del repositorio.
Git debe ignorar elementos como:
- .env
- credenciales locales
- contraseñas
- tokens
- claves de correo
- logs
- respaldos operativos
- dumps privados
Las credenciales integradas fueron retiradas del código y la configuración sensible se mantiene mediante variables de entorno o archivos locales ignorados.
<pre>
******************************************************
         ** --  DOCUMENTACIÓN TÉCNICA  -- **          
******************************************************
</pre>

- [`Estructura.txt`](Estructura.txt)
- [Presentación del proyecto](documentacion/guias/presentacion_proyecto.md)
- [Arquitectura actual](documentacion/arquitectura/2026-08-22_arquitectura_actual.md)
- [Flujo de calidad](documentacion/arquitectura/2026-08-22_flujo_de_calidad.md)
- [Configuración de correo](documentacion/guias/2026-08-21_configurar_correo.md)
- [Cierre técnico MySQL](documentacion/guias/cierre_tecnico_mysql.md)
- [Acceso público](documentacion/guias/acceso_publico_ssh.md)
<pre>
******************************************************
         ** --  PUBLICACIÓN EN GITHUB  -- **          
******************************************************
</pre>

El código fuente puede mantenerse en GitHub para:
- control de versiones;
- historial de commits;
- respaldo del código;
- trazabilidad;
- colaboración.
Repositorio:
SistemaDeAsistenciaADSO
GitHub Pages no ejecuta el servidor Node.js, MySQL ni los servicios de correo.
Para disponer de un enlace público permanente sería necesario alojar también el servidor y la base de datos en una infraestructura compatible.
<pre>
******************************************************
          ** --  FLUJO RÁPIDO DE USO  -- **           
******************************************************
</pre>

1. Instalar dependencias
2. Configurar .env
3. Verificar MySQL
4. Iniciar servidor
5. Abrir login
6. Usar el sistema
7. Ejecutar pruebas después de cambios
Comandos esenciales:
npm.cmd install
npm.cmd start
npm.cmd test
<div align="center">


<pre>-- SISTEMA DE ASISTENCIA SENA --</pre>

Proyecto académico de Análisis y Desarrollo de Software
Repositorio: SistemaDeAsistenciaADSO
</div>
