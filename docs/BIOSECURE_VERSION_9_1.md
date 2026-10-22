# BioSecure SENA 9.1 — cambios y despliegue

## Alcance de esta entrega

Versión incremental sobre 8.9.1. Se conserva la arquitectura HID/WSL2/libfprint/C/Python/Node, el almacén cifrado de plantillas, la asistencia por huella, QR, reportes y las funciones existentes.

El administrador puede ingresar desde **Estadísticas** al módulo **Registrar huella**. El panel muestra un recuento obtenido en el servidor sin revelar nombres, documentos, muestras o plantillas. Modo simulado se etiqueta como tal. El número se refiere a los aprendices presentes en el directorio actual; una plantilla cifrada ausente del directorio no se incluye.

## Instalación en Windows 11 (uso real)

1. Conserva sin alterar la carpeta original 8.5 y respalda **localmente**, fuera de Git, sus plantillas reales y su `.env`.
2. Extrae esta versión en una carpeta nueva, sin mover `node_modules` de otra instalación.
3. Instala Node.js 18+ y ejecuta `npm.cmd ci` en PowerShell.
4. Configura `.env` propio basándote en `.env.example`, incluyendo MySQL y claves de seguridad. No compartas ningún secreto. El usuario MySQL `root` no es válido para la app.
5. Ejecuta las migraciones indicadas por tu instalación, comprueba la conexión con `npm.cmd run doctor`, e inicia `ABRIR_PROYECTO.cmd`.
6. Para usar huellas REALES conserva EXACTAMENTE la clave `BIOMETRIC_ENCRYPTION_KEY` que usaste al enrolar en 8.5 y traslada sólo de forma local las plantillas cifradas a `datos/biometria_real/plantillas`. Configura `BIOMETRIC_ENABLED=true`, `BIOMETRIC_MODE=real` y el puente local con permisos; no sustituir por modo mock para hacer pasar la validación.
7. Desde `http://localhost:3000/estadisticas.html`, administrador: Registrar huella. Comprueba estado REAL, sensor, autorización, plantilla consultable y asistencia en MySQL usando el mismo dedo.
8. Una instalación con `BIOMETRIC_ENABLED=false` puede mostrar conteos del modo configurado, pero **no** puede capturar huellas.

## Demostración visual sin MySQL

Ejecuta `ABRIR_DEMO_LOCAL.cmd`. Levanta datos ficticios en puerto 3100. **No es producción**: no utiliza credenciales, huellas ni bases reales.

## Validación

La suite automatizada prueba errores HTTP, roles, rutas, privacidad del resumen y casos biométricos simulados. Sin acceso al equipo Windows del usuario, MySQL y el sensor físico, no puede certificarse enrolamiento real ni identificación física extremo a extremo. Esa validación debe realizarse localmente y adjuntarse al informe.
