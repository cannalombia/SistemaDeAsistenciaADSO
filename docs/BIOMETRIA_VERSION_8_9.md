# Sistema SENA · BioSecure 8.9

**Actualizado:** 19 de octubre de 2026
**Componente:** DigitalPersona U.are.U 4500, WSL2 Ubuntu 24.04, `libfprint` / `uru4000`, puente Python y Node.js.

## Qué se conservó

- Asistencia → Huella digital sigue siendo la pantalla de identificación integrada: no existe un segundo identificador paralelo.
- `huella_registro.html` continúa siendo la única pantalla de enrolamiento; Crear usuario navega a ella.
- Las reglas de asistencia, fichas, jornadas y ticket de un solo uso permanecen en el backend original.
- QR, módulos de usuarios, reportes, estadísticas y MySQL no se han rediseñado.

## Mejoras de la 8.9

1. Consola visual de enrolamiento de alto contraste, diseño responsive y animaciones ligadas al **estado real** de la operación. El progreso solo aumenta cuando Python comunica una etapa aceptada por libfprint.
2. Búsqueda rápida por nombre, documento y ficha, botón Comprobar lector, prevención de acciones simultáneas y protección frente a respuestas atrasadas de consultas.
3. Confirmación explícita del administrador de que existe **autorización documentada** para el tratamiento biométrico, validada también por Node y registrada en auditoría. Esta casilla **no sustituye** la obtención ni archivo del consentimiento legal.
4. Confirmación del almacenamiento cifrado antes de cerrar exitosamente el enrolamiento. Si fallan disco/cifrado, la captura no se marca como guardada.
5. Tras cancelar, el puente reserva el sensor hasta que el proceso se detiene físicamente, evitando operaciones concurrentes.
6. Bloqueo de rutas `/api/biometria/*` frente al túnel público y otras IP: acceso únicamente en el equipo del lector mediante `localhost`/`127.0.0.1`. El resto de la aplicación mantiene su comportamiento previo.
7. Identificación con efectos de lectura pero **sin simular un contador progresivo de coincidencias**; el éxito se anuncia tras la confirmación de asistencia.

## Instalación de nueva copia

1. **No sobrescribas la 8.5 ni elimines sus datos.** Conserva respaldo seguro de `.env`, MySQL y plantillas cifradas (fuera del ZIP compartible).
2. Extrae `VERSION 8.9 HID DIGITAL` en una nueva carpeta. Abre PowerShell allí y ejecuta `npm ci` con Node.js >= 18.
3. Copia tus valores de `.env` original privado a un nuevo `.env` o crea uno a partir de `.env.example` y configúralo. Para recuperar huellas previas, usa exactamente la clave de cifrado original. No publiques el archivo.
4. Conserva tus datos reales y base MySQL en el equipo local. Si acabas de instalar, configura las credenciales y ejecuta `npm run reset:admin` cuando corresponda.
5. Deja una sesión WSL2 abierta. En **PowerShell de Windows, no dentro de Ubuntu**, verifica `usbipd list`, y cuando el dispositivo `05ba:000a` esté en `Shared`, ejecuta como administrador `usbipd attach --wsl --busid 1-3` (el BUSID puede cambiar).
6. Comprueba el dispositivo desde PowerShell: `wsl -d Ubuntu-24.04 -- lsusb`. Si son necesarios permisos de usuario, verifica el dueño/grupo de `/dev/bus/usb/BBB/DDD` y establece una regla udev limitada a `05ba:000a`. Nunca ejecutes el servicio sin restricción de permisos.
7. Usa el script original `puente_biometrico_real/INSTALAR_BIOMETRIA_REAL.cmd` para instalar/compilar en el PC Windows/WSL si el binario local no coincide con las fuentes. El ejecutable incluido fue compilado fuera de este ambiente y **no ha sido verificado en este entorno**.
8. Inicia `ABRIR_PROYECTO.cmd` o el supervisor biométrico y Node por separado. Verifica `npm run doctor:biometria` en PowerShell.
9. Abre **http://localhost:3000/login.html**. Desde Crear usuario, selecciona un aprendiz de prueba autorizado, confirma la autorización y registra la huella. Luego verifica y usa Asistencia → Huella digital.

## Pruebas automáticas

- `npm test`: suite existente de Node (no requiere lector físico).
- `python3 pruebas/prueba_puente_biometrico_89.py`: prueba sin sensor el HTTP del puente, auth, rangos y cancelación segura.
- `npm run doctor:biometria`: diagnóstico de Windows/WSL, requiere hardware y PowerShell; no se puede ejecutar en una máquina Linux aislada.

## Validación manual pendiente, en el PC del usuario

- Lectura USB activa, permisos suficientes para `fp_device_open_sync`, y servicios `:3000` / `:4318` accesibles.
- Enrolamiento físico del dedo, observando las etapas efectivamente aceptadas, almacenamiento cifrado y verificación contra el mismo dedo.
- Identificación 1:N de la ficha correcta y confirmación de asistencia con control de duplicados.
- Cancelación en medio de captura y reconexión posterior; pruebas de timeout y desconexión USB.

**Privacidad:** no se deben subir a GitHub imágenes de huellas, archivos `.bio.json`, llaves de cifrado, `.env`, copias `.env.bak`, registros operativos con datos personales ni credenciales. Las plantillas son datos sensibles. La aplicación real sigue requiriendo protección organizacional, controles de consentimiento, retención y cumplimiento normativo antes de usar huellas de aprendices reales.
