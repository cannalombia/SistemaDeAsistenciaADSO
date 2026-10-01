# Acceso público con SSH y localhost.run

No requiere instalar paquetes: utiliza el SSH de Windows y las dependencias que ya tiene el proyecto.

1. En una terminal PowerShell, abre el túnel y déjalo funcionando:

   ```powershell
   ssh -R 80:localhost:3000 nokey@localhost.run
   ```

   En este Windows usa `ssh -4 -R 80:localhost:3000 nokey@localhost.run` para que localhost se resuelva por IPv4, igual que la escucha `0.0.0.0`. También puedes ejecutar `npm.cmd run tunnel`, que añade IPv4, comprobación del reenvío y mensajes de mantenimiento de conexión. En la primera conexión SSH puede pedir confirmar la clave del servidor.

2. Copia la URL **HTTPS** que imprime SSH (el dominio puede terminar en `.lhr.life`). En otra terminal, desde la carpeta del proyecto:

   ```powershell
   $env:PUBLIC_URL = "https://DOMINIO-ASIGNADO"
   $env:PORT = "3000"
   npm.cmd start
   ```

   Si ya está iniciado, detén primero ese servidor y vuelve a iniciarlo con esta variable. Cambiar la variable no modifica un proceso que ya está ejecutándose. Si usas el supervisor automático, configura `PUBLIC_URL` en `.env` antes de reiniciar el servidor supervisado.

3. Abre `https://DOMINIO-ASIGNADO/login.html` desde el celular con Wi-Fi desactivado. Inicia sesión desde ese mismo dominio. Genera un QR nuevo: su dirección será `https://DOMINIO-ASIGNADO/asistencia_qr.html?token=...`.

También puedes guardar `PUBLIC_URL=https://DOMINIO-ASIGNADO` en `.env`. Las variables de la terminal tienen prioridad sobre `.env`. Usa solo el origen, sin `/login.html`, parámetros ni credenciales. Sin `PUBLIC_URL`, el QR conserva el acceso local usando la dirección de la solicitud.

El servidor escucha en `0.0.0.0:3000`. Login, asistencia y API responden con `Access-Control-Allow-Origin: *`, incluyendo solicitudes OPTIONS. La autenticación usa cookies: abre interfaz y API desde el mismo dominio público; CORS `*` no habilita cookies entre orígenes distintos.

Mantén el PC encendido, conectado a Internet y los procesos Node y SSH abiertos. Al reconectar el túnel gratuito puede cambiar la URL: actualiza `PUBLIC_URL`, reinicia Node y genera un QR nuevo. Los QR de asistencia caducan a los 60 segundos; el QR que muestra SSH solo abre el sitio y no registra asistencia.

No hace falta abrir puertos en el router. El acceso desde datos móviles depende de que el túnel siga activo y la red permita acceder al servicio. Documentación: https://localhost.run/docs/

Comprobación local del QR y CORS: `node pruebas/prueba_public_url.js`.
