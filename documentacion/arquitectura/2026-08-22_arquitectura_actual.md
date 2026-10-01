# Cómo está armado el proyecto

El sistema funciona como una aplicación Node.js con interfaz web y MySQL 8.4
LTS como persistencia operacional definitiva. El navegador muestra las
pantallas y el servidor se encarga del acceso, los datos y el correo.

## Qué ocurre al abrir una pantalla

1. El navegador carga un archivo de `aplicacion/paginas HTML`.
2. `autenticacion.js` consulta la sesión antes de mostrar información privada.
3. `navegacion.js` construye el menú que corresponde al rol.
4. El script de la pantalla solicita datos a la API.
5. Las rutas del servidor envían la solicitud al grupo adecuado: acceso,
   usuarios, formación o estado del sistema.
6. Los módulos de dominio validan las reglas y persistencia guarda los cambios.

El menú se construye en un solo lugar. Esto evita corregir el mismo enlace en
diez páginas distintas. La gestión de usuarios también tiene un archivo propio,
`usuarios.js`, porque allí conviven el formulario, la tabla y la importación CSV.

## Decisiones que se tomaron

### Persistencia

MySQL es la fuente activa cuando `DATA_SOURCE=mysql` y la marca
`app_settings.source_definitive` confirma el corte. Las migraciones y la carga
legacy se ejecutan con una cuenta separada; la aplicación usa permisos mínimos.
CSV y JSON permanecen como respaldo legacy y no intervienen en la persistencia
operacional.

### Correo

El envío acepta Gmail o Resend. Se agregó una cola porque varias solicitudes al
mismo tiempo podían saturar el proveedor. También se guardan intentos fallidos y
se repiten únicamente los errores temporales. Aun así, el proveedor externo
puede rechazar una cuenta mal configurada; el código no puede evitar ese límite.

### Acceso y configuración

El navegador no guarda usuarios ni contraseñas. El formulario de ingreso, la
edición del perfil y el cambio de contraseña consultan al mismo servidor. Antes
había funciones locales heredadas de la maqueta inicial; se retiraron porque
mostraban opciones que no modificaban la cuenta utilizada para iniciar sesión.

La cuenta administrativa conserva su nombre, correo y contraseña en el archivo
local de credenciales. Ese archivo está excluido de Git. Si el administrador
olvida la clave, `npm.cmd run reset:admin` la reemplaza sin borrar el nombre ni
el correo que ya había configurado.

No existen hashes ni salts reales integrados en el código. La cuenta de
instructor y cualquier bootstrap administrativo obtienen su material desde
variables locales ignoradas. `.env.example` contiene solo nombres y plantillas.

### Servidor

`servidor/servidor.js` coordina los casos de uso y carga el estado mediante el
repositorio MySQL. La decisión de qué controlador atiende cada dirección está separada
en `servidor/rutas`: `acceso.js`, `usuarios.js`, `formacion.js` y `sistema.js`.
Así se puede localizar una ruta sin recorrer el archivo completo.

## Lo que todavía falta mejorar

- `servidor/servidor.js` continúa siendo grande. Extraer cada controlador exige
  separar primero el estado compartido para no duplicar reglas.
- Fichas, horarios y ambientes aún comparten parte de `aplicacion.js`.
- Las pruebas recorren la API y las páginas principales, pero no sustituyen una
  revisión visual en distintos tamaños de pantalla.
- El funcionamiento público necesitaría alojamiento para Node.js, acceso seguro
  a MySQL y un proveedor de correo preparado para producción.

Estas limitaciones se dejan escritas porque también forman parte del proyecto.
Ocultarlas haría más difícil saber cuál es el siguiente cambio razonable.
