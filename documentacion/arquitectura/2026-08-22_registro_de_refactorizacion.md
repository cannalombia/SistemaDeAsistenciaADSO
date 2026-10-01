# Registro de refactorización — 2026-08-22

## Motivo

El proyecto funcionaba, pero varios archivos concentraban demasiadas tareas y
había fragmentos repetidos en todas las páginas. Eso hacía más difícil encontrar
un error y daba la impresión de que el sistema había crecido sin una revisión
posterior.

## Cambios realizados

- Se llevó la configuración de rutas físicas a un solo archivo.
- Se separaron las utilidades, la persistencia y el servicio de correo.
- Se extrajeron reglas de programas, usuarios y estadísticas a módulos de
  dominio que no dependen del servidor HTTP.
- Se reemplazaron diez menús laterales copiados por un componente común.
- El comportamiento móvil quedó junto a la navegación que controla.
- Programas y gestión de usuarios dejaron de compartir un único archivo con el
  resto de las pantallas.
- El CRUD de usuarios quedó en `usuarios.js`. Sus comandos principales tienen
  comentarios `//` para que puedan explicarse como evidencia del trabajo de
  clase sin perder la conexión real con el servidor.
- Los datos visuales de muestra quedaron en un archivo identificado y reducido.
- La hoja general de 2.635 líneas quedó distribuida en cinco archivos temáticos,
  conservando el mismo orden de carga.
- Se corrigieron dos nombres con caracteres dañados y las palabras `Mañana` y
  `Miércoles` en la fuente SQL.
- Se añadieron pruebas unitarias y se mantuvieron las pruebas de integración.
- Se retiraron credenciales visibles del índice de carpetas.
- Los datos operativos y respaldos locales se excluyeron de Git. Se añadieron
  muestras anónimas y creación automática para instalaciones nuevas.

## Decisiones

No se cambió JSON/CSV por una base de datos durante esta refactorización. Esa
migración afecta instalación, copias de seguridad y despliegue; merece una tarea
propia con un plan de conversión de datos.

No se dividió `aplicacion.js` por completo. Se extrajeron las pantallas con
fronteras claras y se conservaron juntas las funciones breves que comparten
almacenamiento local, diálogos y notificaciones. Separarlas ahora añadiría más
conexiones entre archivos que beneficio real.

## Verificación

El comando `npm.cmd test` ejecuta primero las pruebas de módulos y después las
pruebas de integración. Ambas deben pasar antes de aceptar nuevos cambios.

## Limpieza posterior

Al volver a revisar el CRUD se encontraron elementos que no ayudaban a gestionar
usuarios: un reloj, un historial temporal y sonidos creados únicamente para
mostrar métodos de JavaScript. Se retiraron sin cambiar las operaciones reales.

Las pruebas dejaron de exigir una lista de palabras dentro de `usuarios.js`. Los
recorridos de la API ya crean, consultan, actualizan, desactivan, importan y
eliminan usuarios, por lo que esos resultados son ahora la evidencia principal.

Las rutas HTTP se agruparon en `servidor/rutas` y se eliminó del índice local la
credencial que se había escrito allí por error.
