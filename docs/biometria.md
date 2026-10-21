<!--
Archivo: biometria.md

Propósito:
Documentar la integración biométrica real y el modo mock de respaldo.

Responsabilidad:
Explicar arquitectura, instalación, seguridad, operación y límites.
-->

# Integración biométrica — DigitalPersona U.are.U 4500

## Estado confirmado

El lector `05ba:000a` fue validado físicamente con esta ruta:

```text
DigitalPersona U.are.U 4500
→ usbipd-win
→ WSL2 / Ubuntu 24.04
→ libfprint / fprintd
→ enrolamiento real
→ verificación real (verify-match)
```

Por tanto, el proyecto admite dos modos:

- `BIOMETRIC_MODE=mock`: pruebas sin hardware.
- `BIOMETRIC_MODE=real`: DigitalPersona real mediante WSL2 + libfprint.

El proyecto no requiere el SDK comercial de HID para esta integración.

## Arquitectura real

```text
Frontend HTML/JS
        ↓
Servidor Node.js :3000
        ↓
cliente_biometrico.js
        ↓ HTTP local + Bearer
Puente real :4318 (WSL2)
        ↓
motor_biometrico (libfprint)
        ↓ USB
DigitalPersona U.are.U 4500
```

El navegador nunca conoce la dirección interna del puente, las claves, las
plantillas ni imágenes de huella.

## Plantillas biométricas

El motor libfprint serializa `FpPrint`. El servidor Node.js cifra esa plantilla con
AES-256-GCM antes de persistirla.

Ubicación local:

```text
datos/biometria_real/plantillas/
```

Cada archivo se cifra con:

- clave de 256 bits en `BIOMETRIC_ENCRYPTION_KEY`;
- IV aleatorio por registro;
- authentication tag GCM;
- `usuario_id` como AAD, evitando mover un registro cifrado entre usuarios.

La clave, el almacén real y los logs biométricos están excluidos de Git y de la
entrega segura.

## Instalación inicial — una sola vez

Requisitos en Windows:

1. WSL2.
2. Ubuntu 24.04.
3. `usbipd-win`.
4. DigitalPersona compartido con usbipd.

Para preparar el motor, ejecutar:

```text
puente_biometrico_real\INSTALAR_BIOMETRIA_REAL.cmd
```

El instalador abre Ubuntu y ejecuta `instalar_wsl.sh`, que instala las cabeceras de
libfprint y compila el motor C.

El `bind` de usbipd requiere privilegios de administrador la primera vez:

```powershell
usbipd list
usbipd bind --busid <BUSID>
```

Después, `asegurar_biometria.ps1` intenta hacer `attach` automáticamente en cada
arranque si el lector está compartido.

## Configuración

```env
BIOMETRIC_ENABLED=true
BIOMETRIC_MODE=real
BIOMETRIC_SERVICE_URL=http://127.0.0.1:4318
BIOMETRIC_SERVICE_KEY=
BIOMETRIC_ENCRYPTION_KEY=
BIOMETRIC_TIMEOUT_MS=5000
```

Las dos claves se generan automáticamente por el supervisor cuando faltan. No las
copies a `.env.example` ni a una entrega pública.

## Enrolamiento

Solo el rol `Administrador` puede enrolar, reemplazar o eliminar una huella.

Flujo:

```text
Crear / editar aprendiz
→ Registrar huella
→ colocar índice derecho varias veces
→ libfprint genera FpPrint
→ puente devuelve la plantilla solo a Node
→ Node cifra con AES-256-GCM
→ frontend recibe únicamente “huella registrada”
```

No se guardan imágenes.

## Identificación 1:N

En Asistencia, el servidor obtiene todos los aprendices activos de la ficha y carga
únicamente las plantillas reales enroladas de esos candidatos. Las descifra en memoria
y las envía al puente local para la operación de identificación de libfprint.

Si el driver activo no anuncia `FP_DEVICE_FEATURE_IDENTIFY`, el puente devuelve
`IDENTIFICACION_NO_SOPORTADA` en lugar de fingir un resultado.

## QR como respaldo

Una caída de WSL, usbipd, libfprint o del lector no debe tumbar el sistema principal.
El QR y el registro manual continúan disponibles.

## Inicio automático

`ABRIR_PROYECTO.cmd` llama primero a `asegurar_biometria.ps1` y luego al supervisor
del servidor. En modo real el supervisor:

1. comprueba `usbipd-win`;
2. localiza `05ba:000a`;
3. intenta adjuntarlo a `Ubuntu-24.04`;
4. verifica `lsusb`;
5. comprueba que el motor esté compilado;
6. inicia el puente real en WSL;
7. valida `/v1/salud`.

Si falla, el sistema sigue abriendo y el frontend indica que la huella no está
disponible.

## Modo mock

Para volver temporalmente a simulación:

```env
BIOMETRIC_MODE=mock
```

No hace falta cambiar frontend ni rutas porque ambos puentes implementan el mismo
contrato HTTP.

## Cierre PRO 2026-10-17

La integración biométrica usa una sola fuente de configuración para el puente: `BIOMETRIC_SERVICE_URL`.
El supervisor extrae de esa URL el puerto y lo entrega tanto al puente mock como al puente real; así se evita que Node apunte a un puerto distinto del proceso biométrico.

### Puertos y fronteras

- `3000/tcp`: servidor web principal de Node.js. Es la única interfaz que consume el navegador.
- `4318/tcp` por defecto: puente biométrico local. Escucha únicamente en `127.0.0.1` y exige Bearer interno.
- `3306/tcp` por defecto: MySQL local/configurado. Las plantillas biométricas no se guardan allí.
- USB `05ba:000a`: DigitalPersona U.are.U 4500, adjuntado a `Ubuntu-24.04` mediante usbipd-win.

El navegador nunca recibe la URL/clave del puente ni las plantillas. En modo real, Node cifra las plantillas con AES-256-GCM y conserva QR como fallback si biometría no está disponible.

### Diagnóstico integral

Ejecuta:

```powershell
npm run doctor:biometria
```

Comprueba WSL, Ubuntu, usbipd, lector en Windows, estado Attached, visibilidad en `lsusb`, motor libfprint, configuración, puente real y servidor principal sin mostrar secretos.

### Interfaz biométrica

La pantalla de asistencia incluye un escáner visual animado con estados `idle`, `waiting`, `processing`, `success` y `error`. En modo real el banner cambia automáticamente a **BIOMETRÍA REAL ACTIVA**. En modo mock conserva **MODO BIOMÉTRICO DE PRUEBA**. Las animaciones respetan `prefers-reduced-motion`.
