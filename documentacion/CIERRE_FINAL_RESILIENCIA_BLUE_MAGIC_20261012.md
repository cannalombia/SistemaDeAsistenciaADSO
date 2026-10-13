# CIERRE FINAL DE RESILIENCIA — BLUE MAGIC

**Build:** `2026-10-12-final-resilience-r1`
**Base:** `BLUE_MAGIC_V7_2_ESTADISTICAS_VIVAS_20261012`
**Objetivo:** cerrar la aplicación con protección frente a fallos de proceso, operaciones repetidas, caída temporal de servicios externos y ejecución segura de más de una instancia Node.js.

## 1. Resultado arquitectónico

Blue Magic conserva su arquitectura de **monolito modular Node.js + MySQL**. No se introdujeron microservicios. La evolución se concentró en hacer que el estado crítico deje de depender exclusivamente de la memoria de un único proceso.

En modo MySQL, las mutaciones siguen utilizando el modelo de snapshot existente para no romper la lógica académica ya validada, pero ahora se ejecutan bajo un **lock distribuido MySQL**, recargan el estado fresco antes de modificarlo y confirman el snapshot dentro de una transacción. Un número de revisión permite que otra instancia detecte cambios y recargue el estado. Este enfoque evita actualizaciones perdidas entre dos procesos Node sin reescribir todo el dominio en esta versión final.

## 2. Cambios incorporados

### MySQL y estado compartido

Migración `003_resiliencia_multiinstancia`:

- `app_runtime_state`: OTP, recuperación y límites compartidos.
- `app_sessions`: sesiones compartidas entre instancias.
- `app_qr_tokens`: QR generado por un nodo y validable por otro.
- `app_idempotency`: respuestas de mutaciones repetibles sin duplicar operaciones.
- `app_email_outbox`: cola durable de correos.
- `app_instance_heartbeats`: presencia y estado de instancias Node.
- `data_revision`: revisión monotónica del estado de aplicación.
- índice único de asistencia efectiva por documento/ficha/fecha/jornada.

El repositorio MySQL incluye transacciones, `GET_LOCK/RELEASE_LOCK`, revisión compartida, limpieza de runtime, sesiones, QR, idempotencia, outbox y heartbeats.

### Servidor Node.js

- `/api/health/live`: confirma que el proceso Node está vivo sin depender de MySQL.
- `/api/health/ready`: confirma que la instancia puede recibir tráfico.
- `/api/health`: diagnóstico completo de build, instancia, memoria, MySQL, almacenamiento, correo, circuit breaker y nodos activos.
- `X-Request-Id` y `X-Blue-Magic-Instance` en respuestas.
- `Idempotency-Key` en mutaciones POST/PATCH/DELETE.
- sincronización por revisión y lock distribuido en mutaciones MySQL.
- sesión y QR compartidos por MySQL.
- cierre ordenado por `SIGINT`/`SIGTERM`.
- recuperación controlada frente a `unhandledRejection` y `uncaughtException`.
- límites HTTP explícitos para request, headers, keep-alive y solicitudes por socket.
- `TRUST_PROXY=1` disponible únicamente para balanceadores propios y confiables.
- directorio de respaldo configurable mediante `BACKUP_DIR`.

### Correo

- Circuit breaker con estados `closed/open/half_open`.
- Outbox durable MySQL para recuperar envíos pendientes después de reiniciar Node.
- Se conservaron los reintentos, backoff, timeouts e idempotencia del proveedor cuando aplica.
- Una caída del proveedor de correo no debe tumbar el servidor principal.

### Navegador

`resiliencia_cliente.js` se carga en las 12 páginas. Para mutaciones API añade identificador de solicitud e idempotencia, reutilizando temporalmente la misma clave cuando el navegador repite exactamente la misma operación.


### Datos del panel de estadísticas

Se conservaron los datos visuales recientes y se completó también la semana `2026-09-28` a `2026-10-02`. Junto con `2026-10-05` a `2026-10-09`, el rango automático de 14 días puede mostrar dos semanas laborales con actividad en Evolución diaria, Distribución de estados y Composición por ficha. La validación de integridad encontró **0 claves duplicadas** para documento/ficha/fecha/jornada.

### Supervisor de Windows

- watchdog cada 10 segundos;
- consulta `/api/health/ready`;
- protección contra crash-loop: máximo de reinicios dentro de una ventana;
- logs y reporte de `instanceId`;
- tarea de inicio automático preparada para ejecutar el vigilante continuo.

### Multi-instancia

En `herramientas/alta_disponibilidad/` se incluyen:

- inicio y detención de dos Node locales (`3001` y `3002`);
- verificación de ambos nodos;
- ejemplo HAProxy con health checks;
- ejemplo Nginx con balanceo y reintento de upstream;
- ejemplo para apuntar al endpoint RW de MySQL Router.

**Requisito:** el modo multi-instancia exige `DATA_SOURCE=mysql` y la migración 003 aplicada.

## 3. Mejora visual final — portal del aprendiz

El formulario **Presentar una excusa** fue ajustado para mantener el mismo nivel visual del administrador:

- selector de archivo con botón profesional SENA;
- caja de archivo con mejor altura, borde, sombra y estados hover/focus;
- separación clara entre soporte, motivo, botón y tabla de historial;
- área de motivo más cómoda;
- botón de envío con espaciado propio;
- modo oscuro y responsive conservados.

No se alteraron las reglas de negocio de excusas.

## 4. Activación después de reemplazar la versión

### Instalación normal

```powershell
npm ci
npm test
```

### Si el sistema ya trabaja con MySQL

Usa la cuenta de migraciones configurada en `.env` y ejecuta:

```powershell
npm run db:migrate
npm run db:validate
npm test
```

Después inicia normalmente:

```powershell
npm start
```

Comprueba:

- `http://localhost:3000/api/health/live`
- `http://localhost:3000/api/health/ready`
- `http://localhost:3000/api/health`

El `buildId` esperado es `2026-10-12-final-resilience-r1`.

## 5. Demostración de dos Node en un PC

Primero debe estar MySQL activo y migrado. Luego:

```powershell
powershell -ExecutionPolicy Bypass -File .\herramientas\alta_disponibilidad\iniciar_dos_nodos.ps1
powershell -ExecutionPolicy Bypass -File .\herramientas\alta_disponibilidad\verificar_nodos.ps1
```

Esto levanta, por defecto:

- `blue-magic-node-01` → puerto `3001`
- `blue-magic-node-02` → puerto `3002`

Después puede instalarse HAProxy o Nginx usando los ejemplos incluidos y exponer el balanceador en `3000`.

Detención:

```powershell
powershell -ExecutionPolicy Bypass -File .\herramientas\alta_disponibilidad\detener_dos_nodos.ps1
```

## 6. Qué significa “alta disponibilidad” en esta entrega

Esta versión deja el **software preparado para multi-instancia y failover de proceso**. Dos Node pueden compartir sesiones, QR, OTP/runtime, estado e idempotencia mediante MySQL.

No se puede convertir un único portátil en alta disponibilidad física únicamente con código. Para HA de infraestructura siguen siendo externos al ZIP:

1. al menos dos máquinas/VM para las instancias de aplicación;
2. un balanceador realmente instalado y operando;
3. MySQL InnoDB Cluster/Group Replication en nodos independientes;
4. MySQL Router apuntando al clúster;
5. almacenamiento de backups en un destino independiente del servidor;
6. HTTPS/DNS y, si se requiere, redundancia eléctrica/red.

Por tanto, en un solo PC se puede demostrar **failover de procesos**. En varias máquinas y con MySQL Cluster/Router se convierte en una topología de HA real.

## 7. Criterios de cierre

Antes de congelar la entrega definitiva deben quedar en verde:

- `node --check` en JS del proyecto;
- `npm test`;
- `npm run test:reports`;
- `npm run test:persistence-concurrency`;
- `npm run test:resilience`;
- health `live/ready/full`;
- login y sesión;
- registro de asistencia;
- QR generado por una instancia y confirmado por otra en prueba multi-nodo;
- carga/revisión de excusa;
- caída del correo sin caída general;
- cierre/reinicio de un Node sin pérdida de sesión compartida.

## 8. Nota de entrega

Este ZIP de trabajo conserva los datos operativos heredados de la versión utilizada como base. No debe publicarse como repositorio o ZIP público sin ejecutar antes una sanitización de datos, credenciales derivadas, respaldos, logs y archivos de operación.
