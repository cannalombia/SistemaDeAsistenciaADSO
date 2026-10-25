# Preparación para producción y Hostinger

Fecha: 22/10/2026  
Rama de trabajo: `juan-desarrollo`

## Objetivo

Preparar el Sistema de Asistencia ADSO para un futuro despliegue en un hosting con Node.js, MySQL, HTTPS y dominio propio, manteniendo el funcionamiento local actual.

## Verificación previa al despliegue

Se agregó la herramienta:

`herramientas/hostinger/verificar_hostinger.js`

También se agregó el comando:

`npm.cmd run hostinger:check`

Este verificador revisa configuraciones importantes antes de publicar el sistema:

- `NODE_ENV`
- `DATA_SOURCE`
- `PUBLIC_URL`
- `COOKIE_SECURE`
- `TRUST_PROXY`
- configuración de MySQL
- estado de la biometría

Durante las pruebas locales el verificador detectó opciones pendientes de producción. Esto es normal porque el equipo continúa trabajando con configuración local.

Commit relacionado:

`feat: agregar verificacion previa al despliegue`

## Restricción de CORS

Anteriormente el servidor utilizaba:

`Access-Control-Allow-Origin: *`

en todos los entornos.

Se modificó este comportamiento para conservar el acceso abierto durante el desarrollo local, pero restringirlo en producción al dominio configurado mediante `PUBLIC_URL`.

Cuando una solicitud en producción proviene de un origen diferente al permitido, el servidor responde con código HTTP `403`.

También se actualizaron las pruebas automáticas para validar los dos escenarios.

Commit relacionado:

`fix: restringir CORS para produccion`

## HTTPS y cookies seguras

Se reforzó la configuración destinada al futuro hosting.

Cuando el sistema funciona con:

`NODE_ENV=production`

la cookie de sesión utiliza automáticamente el atributo:

`Secure`

También se agregó soporte para reconocer conexiones HTTPS cuando el sistema se encuentre detrás de un proxy confiable utilizando:

`X-Forwarded-Proto: https`

En este escenario el servidor envía:

`Strict-Transport-Security: max-age=31536000; includeSubDomains`

Esto permite preparar el sistema para trabajar detrás del proxy HTTPS del proveedor de hosting sin modificar el funcionamiento normal en localhost.

Commit relacionado:

`fix: reforzar HTTPS y cookies en produccion`

## Pruebas automáticas

Después de los cambios se realizaron comprobaciones de sintaxis con:

`node --check`

También se ejecutó:

`node pruebas/prueba_public_url.js`

La prueba validó:

- `PUBLIC_URL`
- funcionamiento del QR público y local
- login
- CORS
- solicitudes `OPTIONS`
- escucha IPv4
- origen permitido en producción
- rechazo de orígenes no permitidos
- encabezado HSTS
- cookie de sesión `Secure`

Finalmente se ejecutó la suite completa:

`NODE_ENV=test npm.cmd test`

Las pruebas finalizaron correctamente.

Los mensajes de error de API mostrados durante algunas pruebas corresponden a escenarios negativos simulados intencionalmente.

## Validación manual

Después de actualizar el proyecto también fue necesario aplicar la migración:

`003_resiliencia_multiinstancia`

Se ejecutaron:

`npm.cmd run db:migrate`

`npm.cmd run db:validate`

La validación terminó correctamente.

Posteriormente se inició el sistema mediante:

`npm.cmd start`

El servidor inició correctamente en:

`http://localhost:3000/login.html`

La fuente de datos utilizada fue:

`MySQL (sistema_asistencia_sena)`

Se verificaron manualmente:

- inicio de sesión
- panel principal
- Estadísticas
- Asistencia
- Crear usuario
- generación QR
- cierre de sesión
- endpoint `/api/health`

El endpoint de salud respondió con estado:

`ready`

y confirmó que MySQL se encontraba disponible.

## Biometría

La integración biométrica no fue modificada durante esta etapa.

El lector DigitalPersona se encuentra instalado físicamente en el computador del compañero donde funciona el puente biométrico.

Para el futuro despliegue en internet será necesario adaptar la comunicación entre el sistema publicado y el equipo que contiene el lector.

Esta adaptación queda pendiente para una etapa posterior.

## Estado al cierre

El sistema continúa funcionando localmente con Node.js y MySQL.

Los cambios realizados preparan seguridad y validaciones necesarias para producción sin modificar el comportamiento normal en localhost.

Quedan pendientes:

- comprobación previa de MySQL para despliegue;
- pruebas adicionales de producción;
- integración de verificaciones con GitHub;
- configuración definitiva del hosting;
- dominio y SSL;
- adaptación de la biometría para el sistema publicado.

## Prueba automatica de configuracion para hosting

Se agrego una prueba automatica para comprobar la configuracion MySQL necesaria antes del despliegue.

La prueba se puede ejecutar de forma independiente con:

```bash
npm.cmd run test:hostinger

```

Esta validacion comprueba:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_MIGRATION_USER`
- `DB_MIGRATION_PASSWORD`

La prueba verifica que las variables necesarias existan y que las contrasenas no aparezcan en la salida del verificador.

Resultado esperado:

```text
OK: verificador Hostinger valida MySQL sin exponer contrasenas.
```

La prueba tambien fue integrada en la suite general del proyecto, por lo que se ejecuta mediante:

```bash
NODE_ENV=test npm.cmd test
```

Las variables propias del hosting como `NODE_ENV=production`, `PUBLIC_URL`, `COOKIE_SECURE` y `TRUST_PROXY` se configuraran cuando se disponga del servidor real.