# Pruebas verificadas — BioSecure SENA 9.1

**Fecha:** 2026-10-21. **Sistema verificado:** ZIP de origen BioSecure 8.9.1 con mejoras 9.1.

## Resultados ejecutados (entorno de auditoría)

- `npm test`: **APROBADO** tras ajustar el identificador de compilación y el atributo `aria-hidden` del icono nuevo; incluye `prueba_resumen_biometrico_91.js`.
- `python3 pruebas/prueba_puente_biometrico_89.py`: **3/3 aprobadas**.
- `python3 pruebas/prueba_puente_biometrico_891.py`: **5/5 aprobadas**.
- Servidor visual Node con datos ficticios: **13/13 páginas HTML HTTP 200**; junto con referencias CSS/JS/imágenes/video suman **119 solicitudes HTTP correctas**, sin fallos locales.
- Inicio de sesión de administrador en el servidor de pruebas: HTTP **200**; resumen biométrico administrador: HTTP **200**; usuario sin sesión: HTTP **403**. Rol instructor y host no local rechazados en la nueva prueba.
- Sintaxis Node para los archivos JS nuevos y el servidor: **correcta**.

## Errores hallados y corregidos durante 9.1

1. `prueba_autosostenibilidad.js` rechazaba el nuevo identificador de compilación 9.1 por una regla limitada a versiones antiguas. Se actualizó el patrón de forma conservadora sin eliminar los casos previos.
2. `prueba_proyecto.js` detectó iconos decorativos sin `aria-hidden`. Se añadió el atributo a los iconos nuevos.
3. La primera prueba de `Host` remoto desde Node `fetch` no servía para comprobarlo, porque ese cliente normalizaba la cabecera. La prueba se rehízo con `node:http` y confirmó HTTP 403 para host no local.

Los mensajes `FALLO_SIMULADO`, los HTTP 4xx/5xx esperados por escenarios negativos y el QR de prueba deliberadamente inválido en la salida de `npm test` **son casos intencionales que terminaron aprobados**, no incidencias abiertas del producto. Revisar el código de cada escenario antes de tratar esos mensajes como fallos nuevos.

## Límites que no se deben confundir con éxito de extremo a extremo

- El navegador automatizado Chromium del entorno bloqueó la navegación a localhost con `ERR_BLOCKED_BY_ADMINISTRATOR`, antes de interpretar la interfaz. Es restricción ambiental; **no** acredita un fallo del sitio ni valida interacciones reales del navegador.
- No hay conexión al MySQL privado del portátil, ni lector DigitalPersona U.are.U 4500 real, ni WSL2/libfprint/usbipd reales en este ambiente.
- Las huellas registradas previamente en 8.5 **no se incluyen** en esta entrega. No se confirmó que esa plantilla pueda descifrarse en 9.1 porque faltan el archivo y la clave privados; esta prueba depende de la instalación local original.
- No se comprobó un `npm ci` fresco en Windows 11; en las pruebas Node se reutilizó una copia de dependencias con versiones coincidentes y **no se empaquetó `node_modules`**.
- `ABRIR_PROYECTO.cmd` exige MySQL y `.env`; el ZIP no entrega una instalación de producción ya configurada. El comando `ABRIR_DEMO_LOCAL.cmd` abre una demostración, no un sistema real conectado.

## Comprobación pendiente en el equipo Windows (criterios de aceptación)

1. Configurar `.env` privado, roles y cuentas MySQL; `npm.cmd ci` y migraciones; arrancar servidor por `ABRIR_PROYECTO.cmd`.
2. Administrador: estadísticas → Registro de huellas; verificar que los recuentos están asociados al directorio correcto y que el lector no se anuncia como conectado hasta consultarlo en la consola de enrolamiento.
3. En WSL2, confirmar `lsusb`, controlador, motor C, puente Python y USB físico. Probar captura autorizada y verificación tras reiniciar.
4. Comprobar que la misma plantilla se mantiene cifrada y no se copia a Git/ZIP; reutilizar el respaldo privado 8.5 solo con la clave original.
5. Desde asistencia, identificación 1:N de ficha correcta y confirmación exactamente una vez en MySQL; comprobar cierre, reintentos, error por desconexión y denegación de usuario incorrecto.
6. Probar visualmente en Edge/Chrome real, escritorio y móvil en misma LAN, también con datos vacíos.

**Conclusión precisa:** validación automatizada/software/HTTP aprobada; **homologación completa con hardware y MySQL pendiente**.
