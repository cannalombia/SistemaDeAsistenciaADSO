# Sistema de Asistencia SENA

Este proyecto sirve para llevar el control de usuarios, programas, fichas,
horarios, ambientes y asistencia. También permite que los aprendices ingresen
con un código enviado a su correo.

## Presentación y estructura

Para explicar el proyecto al instructor, consulta la
[guía de presentación](documentacion/guias/presentacion_proyecto.md).
El [mapa de carpetas](Estructura.txt) indica qué contiene cada directorio y
cuáles archivos usa el sistema. El código está separado en `aplicacion/`
(interfaz) y `servidor/` (API y reglas); `pruebas/` contiene las verificaciones.
Los archivos de referencia se conservan en documentación, importaciones
originales y respaldos, separados de los datos activos.

## Estado de cierre

MySQL es la persistencia operacional definitiva y la configuración activa usa
`DATA_SOURCE=mysql`. Las migraciones, el corte, la activación, los reinicios y
la validación posterior quedaron aprobados sin diferencias. CSV y JSON se
conservan únicamente como respaldo legacy; no son la fuente activa.

Las credenciales integradas fueron retiradas del código. Los hashes, salts,
claves de base de datos y proveedores permanecen en `.env` o en archivos
locales ignorados por Git. Git quedó limpio en el commit estable `3f5e5b9` y se
generó el paquete limpio `BLUE_MAGIC_V5_PAQUETE_LIMPIO_2026-10-01.zip`, sin
secretos, datos operativos ni dependencias instaladas.

## ¿Quieres abrirlo?

Para abrirlo desde datos móviles sin instalar nada, consulta la
[guía de acceso público con SSH y localhost.run](documentacion/guias/acceso_publico_ssh.md).

### Persistencia principal

La aplicación consulta y actualiza MySQL. La cuenta de ejecución usa permisos
mínimos y la cuenta de migraciones se reserva para cambios de esquema. El estado
se comprueba en `/api/health`: debe mostrar `database.source=mysql` y
`database.ready=true`.

`usuarios_listo_para_importar.csv` y los JSON de `datos/` son archivos legacy
privados conservados para respaldo y recuperación controlada. No los edites
esperando cambiar la aplicación activa y no los incluyas en entregas públicas.
La guía de cierre y rollback está en
[`documentacion/guias/cierre_tecnico_mysql.md`](documentacion/guias/cierre_tecnico_mysql.md).

La forma más sencilla en Windows es hacer doble clic en
[`ABRIR_PROYECTO.cmd`](ABRIR_PROYECTO.cmd). Este acceso comprueba el servidor y
abre la pantalla de ingreso en tu navegador.

También puedes abrir [`index.html`](index.html) y presionar **Abrir el
proyecto**. Si Windows lo abre como código en Visual Studio Code, haz clic
derecho sobre el archivo, selecciona **Abrir con** y elige Chrome o Edge.

También puedes entrar directamente desde esta dirección:
[http://localhost:3000/login.html](http://localhost:3000/login.html).

### Abrirlo desde Visual Studio Code

Abre la carpeta completa del proyecto en Visual Studio Code, presiona `F5` y
elige **Abrir Sistema de Asistencia SENA**. Visual Studio Code comprobará el
servidor y abrirá Edge en la pantalla de ingreso.

No uses **Go Live** para este proyecto. Ese botón solo abre los archivos
visuales y deja por fuera el servidor, la autenticación y el envío de correos.

Si la página no carga, seguramente el servidor todavía no está iniciado. Abre
una terminal en esta carpeta y ejecuta:

```powershell
npm.cmd start
```

Espera a que aparezca el mensaje de confirmación y vuelve a abrir el enlace.

## Antes de instalarlo

Necesitas Windows 10 u 11, Node.js 18 o posterior, npm y MySQL 8.4 LTS. La base
principal, la base de pruebas y las cuentas de aplicación y migración deben
crearse antes del primer inicio.

Para preparar el proyecto por primera vez, usa estos comandos:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd start
```

Completa en `.env` las variables `DB_*`, las credenciales locales de acceso y la
configuración del correo. `.env` está ignorado: no lo compartas ni lo subas a
GitHub. Para Gmail o Resend, sigue la guía
[`documentacion/guias/2026-08-21_configurar_correo.md`](documentacion/guias/2026-08-21_configurar_correo.md).

¿No encuentras algún archivo? En [`Estructura.txt`](Estructura.txt) está el mapa
completo de las carpetas.

## Por qué está organizado así

La primera versión fue creciendo pantalla por pantalla. Para que una corrección
no obligue a buscar por todo el proyecto, cada tarea principal quedó en un lugar
reconocible. El menú vive en `navegacion.js`, el CRUD de usuarios en `usuarios.js`
y el correo en su propio servicio. Las direcciones de la API se agrupan en
`servidor/rutas` según sean de acceso, usuarios, formación o estado del sistema.

MySQL concentra la persistencia transaccional. Los archivos JSON y CSV se
mantienen como respaldo legacy y muestras de instalación, separados de la
operación activa.

La explicación completa, incluidos los límites que todavía tiene el proyecto,
está en
[`documentacion/arquitectura/2026-08-22_arquitectura_actual.md`](documentacion/arquitectura/2026-08-22_arquitectura_actual.md).
Para trabajar nuevas mejoras de forma consistente, usa
[`documentacion/arquitectura/2026-08-22_flujo_de_calidad.md`](documentacion/arquitectura/2026-08-22_flujo_de_calidad.md).

## Mantener el sistema activo

El proyecto incluye un vigilante para Windows. Su trabajo es comprobar que el
servidor siga funcionando y volver a iniciarlo si se detiene.

Para instalarlo:

```powershell
npm.cmd run install:autostart
```

Puedes revisar el estado cuando quieras:

```powershell
npm.cmd run status
```

Y si quieres pedirle que compruebe o inicie el servidor manualmente:

```powershell
npm.cmd run start:ensure
```

## Perfil y contraseña del administrador

Desde **Configuración** puedes cambiar el nombre, el correo y la contraseña de
la cuenta administrativa. Estos cambios pertenecen a la misma cuenta con la que
inicias sesión; no se guardan como una copia separada en el navegador.

Si no recuerdas la contraseña actual, usa `npm.cmd run reset:admin` desde la
carpeta del proyecto. El comando cambia solamente la contraseña y conserva el
nombre y el correo configurados.

## Cómo se comprueba un cambio

Después de hacer cambios, ejecuta las pruebas:

```powershell
npm.cmd test
```

Si aparece el mensaje `OK`, las páginas principales y los recorridos reales de
la API pasaron la revisión. Entre ellos están crear, modificar, desactivar,
importar y eliminar usuarios; no se considera suficiente encontrar una palabra
o un comando escrito dentro del código.

También puedes ejecutar cada grupo por separado:

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
```

## Estadísticas e informes de asistencia

En **Estadísticas**, selecciona una ficha y las fechas inicial y final. Las
gráficas y el detalle por aprendiz se actualizan automáticamente con la
asistencia guardada. El panel vuelve a consultar los datos cada 30 segundos
mientras está visible y no se están editando los filtros.

Pulsa **Generar y guardar** para conservar un informe en el historial. Desde
**Reportes guardados** puedes buscarlo, abrir su detalle y descargar el PDF.
Cada informe conserva los datos originales de su corte, aunque después se
modifique la asistencia. El historial se guarda en MySQL y permanece disponible
al reiniciar el servidor. Inclúyelo en los respaldos privados generados desde
la aplicación.

En **Asistencia**, guarda primero los cambios y pulsa **Exportar PDF**. Se
descarga el informe de la ficha, fecha y jornada seleccionadas, con todos los
aprendices registrados, independientemente de la búsqueda o página visible.
También queda archivado en Estadísticas. Los instructores, administradores y
coordinadores pueden consultar y descargar estos informes.

Los porcentajes usan presentes / registros guardados. Tardanzas, ausencias y
justificaciones se desglosan por separado; los días sin registro no cuentan
como ausencias. Los rangos sin datos no generan informes vacíos.

La biblioteca PDF está incluida localmente en `servidor/vendor`, con su
licencia MIT. No necesita una conexión externa para generar los documentos.
La prueba `npm.cmd run test:reports` usa datos aislados y comprueba filtros,
permisos, persistencia, cortes históricos y PDFs de varias páginas.

## Sobre los datos privados

Las contraseñas, claves de correo, códigos pendientes, historiales de envío y
registros del servidor se quedan en el computador. Git los ignora para evitar
que terminen publicados por accidente.

## Publicarlo en GitHub

GitHub es útil para guardar el código y mantener su historial, pero GitHub Pages
no puede ejecutar este servidor Node.js ni enviar los correos de confirmación.
El repositorio puede estar en GitHub y la aplicación seguir funcionando en este
computador. Para tener un enlace público que funcione desde cualquier lugar,
haría falta alojar también el servidor en un servicio compatible con Node.js.
