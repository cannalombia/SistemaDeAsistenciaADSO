# Validación MySQL para despliegue

Fecha: 24/10/2026  
Issue relacionado: #14 - HU-07 Preparar MySQL para despliegue en hosting

## Objetivo

Validar que la base de datos MySQL del Sistema de Asistencia SENA pueda ser reconstruida correctamente en una instalación limpia y que el proyecto pueda volver a utilizar MySQL como fuente principal antes de preparar el despliegue en hosting.

## Situación inicial

Se reinstaló XAMPP y las bases de datos locales anteriores ya no estaban disponibles.

Las bases esperadas por el proyecto son:

- `sistema_asistencia_sena`
- `sistema_asistencia_sena_test`

Los usuarios configurados para MySQL son:

- `sena_app`
- `sena_migrator`

Las contraseñas permanecen definidas únicamente en el archivo local `.env` y no se incluyen en esta documentación.

## Creación de bases

Se crearon nuevamente las dos bases utilizando:

```sql
CREATE DATABASE IF NOT EXISTS sistema_asistencia_sena
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS sistema_asistencia_sena_test
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Se verificó la existencia de ambas con:

```sql
SHOW DATABASES LIKE 'sistema_asistencia_sena%';
```

Resultado:

```text
sistema_asistencia_sena
sistema_asistencia_sena_test
```

## Usuarios y permisos

Se recrearon los usuarios:

```text
sena_app
sena_migrator
```

El usuario `sena_app` recibió permisos para trabajar con los datos de la aplicación.

El usuario `sena_migrator` recibió permisos para realizar cambios estructurales y ejecutar las migraciones.

Las contraseñas utilizadas fueron tomadas desde `.env` y no quedaron almacenadas en este documento.

## Migraciones

Desde Git Bash se ejecutó:

```bash
npm.cmd run db:migrate
```

Resultado:

```text
Migraciones aplicadas:
001_esquema_aplicacion
002_excusas
003_resiliencia_multiinstancia
```

Esto confirmó que una base vacía puede