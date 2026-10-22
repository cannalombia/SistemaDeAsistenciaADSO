# Correcciones BioSecure SENA 9.1

Fecha de revisión: 21 de octubre de 2026
Entorno revisado: Windows 11, Node.js 24.18.0, MySQL 8.4 (`BlueMagicMySQL`), WSL2 Ubuntu 24.04, usbipd-win y DigitalPersona U.are.U 4500 (`05ba:000a`).

## Diagnóstico real

### 1. El puente biométrico no podía convertir la ruta del proyecto

**Síntoma**

`datos/supervisor_biometria.log` contenía:

```text
wslpath: C:UsersUsuarioDesktopHID_9.1_HTML
```

**Causa**

Windows PowerShell 5.1 entregaba la ruta `C:\...` a `wslpath` mediante el parser nativo y eliminaba las barras invertidas. El mismo defecto estaba en el supervisor, el diagnóstico y el instalador `.cmd`.

**Solución**

Se agregó `herramientas/automatizacion/convertir_ruta_wsl.ps1`. El conversor usa una ruta DrvFs verificada y conserva un respaldo mediante `WSLENV` con el indicador `/p`. Los tres consumidores usan ahora el mismo conversor.

### 2. WSL terminaba el puente iniciado con `nohup`

**Síntoma**

El supervisor solicitaba el inicio, pero el puerto 4318 dejaba de responder y los archivos de salida quedaban vacíos.

**Causa**

Al finalizar la invocación corta de `wsl.exe`, la distribución podía terminar también el proceso Python en segundo plano. Además, los intentos de canalizar un script desde Windows PowerShell agregaban BOM y CRLF, que Bash interpretaba como `﻿cd` y `$'\r'`.

**Solución**

`asegurar_biometria.ps1` mantiene un proceso `wsl.exe` anfitrión mediante `Start-Process` y ejecuta Python directamente con `--exec env`, sin `bash -lc`, `nohup`, BOM ni transformación de comillas.

### 3. El lector estaba compartido, pero no adjunto a WSL

**Síntoma**

`usbipd list` mostraba el U.are.U 4500 como `Shared`, no `Attached`.

**Solución y comprobación**

El supervisor resolvió el BUSID `1-2`, ejecutó el `attach` y comprobó `05ba:000a` con `lsusb`. El motor real respondió:

```json
{"correcto":true,"lector":{"disponible":true,"modelo":"Digital Persona U.are.U 4000/4000B/4500","driver":"uru4000","identificacion_1_n":true,"etapas_enrolamiento":5}}
```

El endpoint autenticado `/v1/salud` y la consulta del lector responden. Esto comprueba la cadena USB/WSL/libfprint/HTTP, pero **no sustituye una captura con un dedo real**.

### 4. Node.js terminaba por falta de credenciales administrativas

**Síntoma**

`datos/servidor_errores.log` contenía:

```text
ERROR DE ARRANQUE: Faltan credenciales administrativas.
```

No existe `datos/credenciales_administrador.json` y `.env` no contiene un par válido `ADMIN_AUTH_SALT`/`ADMIN_AUTH_PASSWORD_HASH`.

**Solución**

Se agregó `herramientas/verificar_credenciales.js`. `ABRIR_PROYECTO.cmd` valida primero las credenciales y, únicamente si no existe ninguna configuración válida, ejecuta de forma interactiva `npm.cmd run reset:admin`. La contraseña se captura oculta y se guarda como `scrypt`; no se escribe en este informe ni se reemplaza una credencial existente. El supervisor de Node también aplica esta comprobación cuando se ejecuta por separado.

**Acción aún requerida por el propietario**

Ejecutar `ABRIR_PROYECTO.cmd` y definir la contraseña administrativa cuando aparezca el aviso. Esta revisión no inventó una contraseña permanente ni modificó las claves de acceso existentes.

### 5. MySQL no se comprobaba antes de iniciar Node

**Estado encontrado**

- Servicio `BlueMagicMySQL`: `Running`, inicio automático.
- Conexión real a `127.0.0.1:3306/sistema_asistencia_sena`: correcta.
- Charset/collation/timezone: `utf8mb4`, `utf8mb4_unicode_ci`, `+00:00`.
- Migraciones: vigentes.

**Solución**

Se agregaron `herramientas/verificar_mysql.js` y `herramientas/automatizacion/asegurar_mysql.ps1`. El flujo valida conexión y migraciones antes de Node. Solo intenta iniciar un servicio `mysqld` detenido; nunca reinicia uno activo. Si existen varios servicios puede usarse `MYSQL_SERVICE_NAME` en `.env`.

### 6. Orden y mensajes de los scripts de arranque

`ABRIR_PROYECTO.cmd` usa ahora este orden:

1. Node.js, `.env`, build y dependencias.
2. MySQL y migraciones.
3. Credenciales de administrador e instructor.
4. Puente biométrico real y diagnóstico accionable.
5. Servidor Node.js y health check del build esperado.
6. Navegador.

Si la biometría falla, el script indica expresamente que QR y asistencia manual siguen disponibles, pero la huella no. El vigilante continuo respeta MySQL → biometría → Node y aplica espera ante fallos.

### 7. Pruebas Python ejecutadas en el sistema operativo incorrecto

**Síntoma**

`prueba_puente_biometrico_891.py` fallaba en Windows con `WinError 193` porque intentaba ejecutar un binario ELF.

**Solución**

Se agregó `herramientas/automatizacion/probar_puente_python.ps1`; `npm run test:python-biometria` ejecuta las dos suites dentro de Ubuntu WSL2.

## Pruebas realizadas

- `npm.cmd test`: aprobada la suite completa de Node, incluyendo login, roles, estadísticas, registro biométrico lógico, asistencia biométrica lógica, QR, asistencia manual, MySQL, concurrencia, reportes, seguridad y resiliencia.
- `npm.cmd run verify`: aprobada; vuelve a ejecutar y valida la suite del proyecto.
- `npm.cmd run test:python-biometria`: 8/8 pruebas aprobadas dentro de WSL.
- `npm.cmd run doctor:mysql`: conexión real y migraciones correctas.
- `npm.cmd run doctor:biometria`: WSL2, Ubuntu, usbipd, USB `Attached`, lector visible, motor compilado y puente autenticado correctos.
- Arranque en frío del puente: código de salida 0.
- Integración temporal Node–MySQL en puerto 3091: base de datos lista, login 200, logout 200, estadísticas, asistencia y estado biométrico respondieron; el health reportó MySQL, puente y lector disponibles.
- La prueba inicial dentro del sandbox falló con `EPERM` al renombrar un archivo temporal; repetida fuera del sandbox, la operación atómica y toda la suite aprobaron. No era un fallo del proyecto.

Algunos mensajes `Error de API` y el error QR controlado que aparecen durante `npm test` pertenecen a casos negativos deliberados; las pruebas correspondientes terminan con `OK`.

## Verificación física pendiente

No se declara completa la biometría de extremo a extremo. Falta realizar, con autorización del titular:

1. Iniciar con `ABRIR_PROYECTO.cmd` y configurar la contraseña administrativa faltante.
2. Iniciar sesión como administrador.
3. Abrir el registro de huella de un aprendiz de prueba autorizado.
4. Completar las cinco etapas colocando el dedo en el U.are.U 4500.
5. Confirmar que la plantilla cifrada se guarda y que no se expone al navegador.
6. Abrir asistencia biométrica, seleccionar ficha/jornada y verificar el mismo dedo.
7. Confirmar que la asistencia aparece una sola vez en estadísticas y reportes.

El hardware fue detectado y consultado realmente; no se utilizó un puente mock ni se reemplazó el reconocimiento por una simulación.

## Archivos agregados o modificados

- `ABRIR_PROYECTO.cmd`
- `.env.example`
- `package.json`
- `herramientas/verificar_mysql.js`
- `herramientas/verificar_credenciales.js`
- `herramientas/automatizacion/asegurar_mysql.ps1`
- `herramientas/automatizacion/asegurar_biometria.ps1`
- `herramientas/automatizacion/asegurar_servidor.ps1`
- `herramientas/automatizacion/diagnostico_biometria.ps1`
- `herramientas/automatizacion/convertir_ruta_wsl.ps1`
- `herramientas/automatizacion/probar_puente_python.ps1`
- `herramientas/automatizacion/vigilante_servidor.ps1`
- `puente_biometrico_real/INSTALAR_BIOMETRIA_REAL.cmd`
- `pruebas/prueba_arranque_windows.js`
- `CORRECCIONES_9_1.md`

## Comandos Git sugeridos

Esta carpeta no contiene `.git`; por eso no fue posible ejecutar `git diff`, crear una rama ni hacer commit. En una copia que sí sea repositorio:

```powershell
git status --short
git diff --check
git add -- ABRIR_PROYECTO.cmd .env.example package.json CORRECCIONES_9_1.md herramientas puente_biometrico_real/INSTALAR_BIOMETRIA_REAL.cmd pruebas/prueba_arranque_windows.js
git diff --cached --check
git commit -m "Corrige arranque de MySQL Node y puente biometrico 9.1"
git status --short
```

No agregar `.env`, `datos/credenciales_administrador.json`, claves, plantillas biométricas ni registros operativos al repositorio.
