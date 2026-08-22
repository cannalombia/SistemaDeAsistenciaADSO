# Configurar el acceso por código de correo

La aplicación permite enviar el código con Gmail o Resend desde
`servidor/servidor.js`. Las claves privadas permanecen en `.env` y nunca se envían
al navegador.

## Opción 1: Gmail

1. Activa la verificación en dos pasos en la cuenta de Google que enviará los
   mensajes.
2. En la seguridad de la cuenta, crea una **contraseña de aplicación**. Google
   mostrará un código de 16 caracteres; no uses la contraseña normal de Gmail.
3. Abre `.env` y completa:

   ```text
   EMAIL_PROVIDER=gmail
   GMAIL_USER=correo_remitente@gmail.com
   GMAIL_APP_PASSWORD=los_16_caracteres
   EMAIL_FROM=Sistema SENA <correo_remitente@gmail.com>
   ```

## Opción 2: Resend

1. Crea una cuenta en https://resend.com, genera una API Key y verifica el
   dominio remitente.
2. Abre `.env` y completa:

   ```text
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_tu_clave_real
   EMAIL_FROM=Sistema SENA <acceso@tu-dominio.com>
   ```

> Importante: `onboarding@resend.dev` es un remitente de prueba. Solo debe
> usarse para validar la cuenta y no garantiza envíos a todos los estudiantes.
> Para operación real verifica un dominio en Resend y configura `EMAIL_FROM`
> con ese dominio, o utiliza Gmail con una contraseña de aplicación.

## Confiabilidad incorporada

El servidor aplica automáticamente:

- tres intentos con espera progresiva ante fallos temporales;
- tiempo límite para evitar solicitudes bloqueadas;
- clave de idempotencia para que un reintento no duplique el mensaje;
- conservación de códigos pendientes y límites aunque el servidor se reinicie;
- revisión del proveedor cada cinco minutos;
- historial sin códigos ni correos completos en
  `datos/historial_envios_correo.json`;
- estado público del proceso en `http://localhost:3000/api/health`;
- historial visible para el administrador desde **Configuración → Servicio de
  correo → Ver historial**.

Los archivos de estado, claves locales e historial están excluidos de Git.

## Mantener el servidor activo en Windows

Instala una sola vez el inicio automático:

```powershell
npm.cmd run install:autostart
```

El instalador intenta usar una tarea programada. Si Windows no concede ese
permiso, registra automáticamente un vigilante en el inicio del usuario, sin
pedir permisos de administrador. Ese vigilante comprueba el servidor cada
minuto y lo recupera si se detiene. También puedes usar:

```powershell
npm.cmd run status
npm.cmd run start:ensure
```

Los registros operativos están en `datos/supervisor_servidor.log`,
`datos/servidor_salida.log` y `datos/servidor_errores.log`.

## Ejecutar y probar

Opcionalmente limita los correos autorizados:

   ```text
   ALLOWED_EMAIL_DOMAIN=sena.edu.co
   ```

   O usa una lista exacta:

   ```text
   ALLOWED_EMAILS=usuario1@correo.com,usuario2@correo.com
   ```

Inicia siempre el proyecto con:

   ```powershell
   npm.cmd start
   ```

El aprendiz debe existir en `datos/aprendices.json` con su cédula y correo.
Abre `http://localhost:3000/login.html`, selecciona "Aprendiz", escribe la
   cédula y pulsa "Enviar código". El código llegará al correo registrado.

Después de cambiar `.env`, detén y vuelve a iniciar el servidor. No uses
`http-server`, porque no ejecuta la API de correo.

No publiques `.env`. El proyecto ya incluye esa exclusión en `.gitignore` y el
servidor bloquea su descarga.
