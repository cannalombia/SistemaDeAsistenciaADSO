<!--
Archivo: README.md

Propósito:
Documentar el uso del puente biométrico mock independiente.

Responsabilidad:
Explicar su alcance, configuración, inicio, pruebas y detención.

Comunicación:
Describe el contrato HTTP que posteriormente consumirá el servidor Node.js principal.

Límites:
No documenta una captura real ni sustituye la documentación oficial de DigitalPersona.
-->

# Puente biométrico mock

> **MODO BIOMÉTRICO DE PRUEBA**

Servicio local independiente que simula el contrato HTTP previsto para la futura integración con DigitalPersona U.are.U 4500.

No utiliza el SDK de DigitalPersona, no accede al lector, no registra asistencias y no crea ni guarda plantillas biométricas reales o falsas.

## Requisitos

- Windows PowerShell.
- Node.js 18 o una versión posterior.

## Configuración

La única variable requerida es `CLAVE_LOCAL_PUENTE`. Debe tener al menos 12 caracteres.

```powershell
$env:CLAVE_LOCAL_PUENTE = "cambie-esta-clave-local"
```

## Inicio

Desde esta carpeta:

```powershell
.\iniciar_puente.ps1
```

El servicio escucha exclusivamente en `http://127.0.0.1:4318`.

## Pruebas

Con el servicio iniciado y la misma variable de entorno configurada:

```powershell
node .\pruebas\prueba_puente_mock.js
```

## Detención

```powershell
.\detener_puente.ps1
```

## Rutas

- `GET /`: página informativa pública.
- `GET /v1/salud`: estado del proceso.
- `GET /v1/lector`: estado simulado del lector.
- `POST /v1/capturas`: inicia una captura simulada.
- `GET /v1/capturas/:id`: consulta una captura.
- `DELETE /v1/capturas/:id`: cancela una captura.
- `POST /v1/pruebas/siguiente_resultado`: define el resultado de la siguiente captura.

Todas las rutas `/v1` requieren `Authorization: Bearer <clave_local>`.
