# Cómo está armado el proyecto

El sistema funciona como una aplicación local. El navegador muestra las
pantallas y un servidor de Node.js se encarga del acceso, los datos y el correo.
Se eligió este formato porque el proyecto se puede demostrar en un computador
sin instalar una base de datos adicional.

## Qué ocurre al abrir una pantalla

1. El navegador carga un archivo de `aplicacion/paginas`.
2. `autenticacion.js` consulta la sesión antes de mostrar información privada.
3. `navegacion.js` construye el menú que corresponde al rol.
4. El script de la pantalla solicita datos a la API.
5. Las rutas del servidor envían la solicitud al grupo adecuado: acceso,
   usuarios, formación o estado del sistema.
6. Los módulos de dominio validan las reglas y persistencia guarda los cambios.

El menú se construye en un solo lugar. Esto evita corregir el mismo enlace en
diez páginas distintas. La gestión de usuarios también tiene un archivo propio,
`script.js`, porque allí conviven el formulario, la tabla y la importación CSV.

## Decisiones que se tomaron

### Datos locales

JSON y CSV resultaron suficientes para una demostración controlada y son fáciles
de revisar durante las clases. La desventaja es clara: no sirven para varias
máquinas escribiendo al mismo tiempo. Si el sistema se publica para uso real,
la primera migración debería ser hacia una base de datos transaccional.

### Correo

El envío acepta Gmail o Resend. Se agregó una cola porque varias solicitudes al
mismo tiempo podían saturar el proveedor. También se guardan intentos fallidos y
se repiten únicamente los errores temporales. Aun así, el proveedor externo
puede rechazar una cuenta mal configurada; el código no puede evitar ese límite.

### Servidor

`servidor/servidor.js` conserva el estado de la aplicación y coordina los casos
de uso. La decisión de qué controlador atiende cada dirección ya está separada
en `servidor/rutas`: `acceso.js`, `usuarios.js`, `formacion.js` y `sistema.js`.
Así se puede localizar una ruta sin recorrer el archivo completo.

## Lo que todavía falta mejorar

- `servidor/servidor.js` continúa siendo grande. Extraer cada controlador exige
  separar primero el estado compartido para no duplicar reglas.
- Fichas, horarios y ambientes aún comparten parte de `aplicacion.js`.
- Las pruebas recorren la API y las páginas principales, pero no sustituyen una
  revisión visual en distintos tamaños de pantalla.
- El funcionamiento público necesitaría alojamiento para Node.js, una base de
  datos y un proveedor de correo preparado para producción.

Estas limitaciones se dejan escritas porque también forman parte del proyecto.
Ocultarlas haría más difícil saber cuál es el siguiente cambio razonable.
