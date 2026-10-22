# Puente biométrico real — DigitalPersona U.are.U 4500

Este módulo reemplaza al puente `mock` cuando `BIOMETRIC_MODE=real`.

## Arquitectura

`DigitalPersona 4500 -> usbipd-win -> WSL2 Ubuntu -> libfprint -> puente real -> Node.js`

El navegador nunca accede al lector. Las plantillas serializadas por libfprint se
cifran en el servidor principal con AES-256-GCM y nunca se entregan al frontend.

## Requisitos confirmados en el equipo de prueba

- Windows 11 x64.
- WSL2 con Ubuntu 24.04.
- `usbipd-win`.
- lector `05ba:000a` adjunto a WSL.
- libfprint compatible con DigitalPersona U.are.U 4000/4000B/4500.

## Instalación única

Desde Ubuntu, en esta carpeta:

```bash
./instalar_wsl.sh
```

Desde PowerShell administrador, compartir el lector una vez:

```powershell
usbipd bind --busid <BUSID>
```

El supervisor del proyecto intentará hacer `attach` automáticamente cuando el
lector ya esté compartido.

## Seguridad

- escucha únicamente en `127.0.0.1:4318`;
- requiere Bearer secret;
- sin CORS;
- no guarda imágenes;
- archivos temporales de plantillas tienen permisos `0600` y se eliminan al terminar;
- la persistencia cifrada pertenece al servidor Node.js.
