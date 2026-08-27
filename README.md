# Sistema de Asistencia SENA

Este proyecto sirve para llevar el control de usuarios, programas, fichas,
horarios, ambientes y asistencia. También permite que los aprendices ingresen
con un código enviado a su correo.

## ¿Quieres abrirlo?

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

Necesitas un computador con Windows 10 u 11, Node.js 18 o una versión más
reciente y npm. Normalmente npm ya viene incluido cuando instalas Node.js.

Para preparar el proyecto por primera vez, usa estos comandos:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd start
```

El archivo `.env` guarda la configuración privada del correo. No lo compartas
ni lo subas a GitHub. Si necesitas configurar Gmail o Resend, sigue la guía
[`documentacion/guias/2026-08-21_configurar_correo.md`](documentacion/guias/2026-08-21_configurar_correo.md).

¿No encuentras algún archivo? En [`Estructura.txt`](Estructura.txt) está el mapa
completo de las carpetas.

## Por qué está organizado así

La primera versión fue creciendo pantalla por pantalla. Para que una corrección
no obligue a buscar por todo el proyecto, cada tarea principal quedó en un lugar
reconocible. El menú vive en `navegacion.js`, el CRUD de usuarios en `script.js`
y el correo en su propio servicio. Las direcciones de la API se agrupan en
`servidor/rutas` según sean de acceso, usuarios, formación o estado del sistema.

Los archivos JSON y CSV se mantienen porque facilitan la demostración local.
No pretenden reemplazar una base de datos cuando varias personas trabajen al
mismo tiempo desde computadores diferentes.

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
