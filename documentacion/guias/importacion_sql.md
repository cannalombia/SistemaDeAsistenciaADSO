# Importación SQL y exportación

En **Crear Usuario → Archivo SQL** se puede subir un archivo `.sql` UTF-8 de
hasta 10 MB. El formulario envía `multipart/form-data` en el campo `SQLFILE`;
la API también acepta `file` como alias. La extensión, el tamaño, la
codificación y el contenido completo se validan antes de modificar datos.

## Flujo recomendado

1. Ingresar como administrador.
2. Elegir **Exportar base actual** y conservar `Base_datos_SENA.sql`.
3. Para restaurar, seleccionar ese mismo archivo y pulsar **Importar SQL**.
4. Confirmar el resumen de usuarios, asistencias, programas y fichas.
5. Abrir Estadísticas: los gráficos consultan inmediatamente la asistencia y
   la formación restauradas.

La exportación y la importación usan el mismo contrato. Antes de guardar, el
servidor valida todas las filas, las relaciones entre programas, fichas,
horarios y ambientes, y una firma SHA-256. Si una validación falla no se aplica
ningún cambio.

## Formato definido

El archivo comienza con una tabla de control:

```sql
CREATE TABLE `sena_respaldo` (`formato` TEXT, `version` TEXT, `checksum` TEXT);
INSERT INTO `sena_respaldo` VALUES ('sena-sql-backup', '2', '<firma sha256>');
```

La tabla de usuarios usa exactamente estas columnas y este orden:

```text
identificacion | tipo_documento | nombre | correo | rol | estado | ficha
```

Ejemplo de una fila:

```sql
CREATE TABLE `usuarios` (`identificacion` TEXT, `tipo_documento` TEXT, `nombre` TEXT, `correo` TEXT, `rol` TEXT, `estado` TEXT, `ficha` TEXT);
INSERT INTO `usuarios` (`identificacion`, `tipo_documento`, `nombre`, `correo`, `rol`, `estado`, `ficha`) VALUES ('800000123', 'Cédula de Ciudadanía', 'María Pérez', 'maria@example.com', 'instructor', 'activo', '');
```

Las colecciones operativas usan una columna `datos_json` y una sentencia
`INSERT` por fila. Las tablas del formato integral son:

- `ambientes`, `fichas`, `horarios` y `programas`;
- `aprendices`, `asistencia`, `reportes` y `cuentas`;
- `auditoria`, `excusas` y `formacion_configuracion`.

Todos los valores son texto entre comillas simples. Un apóstrofo interno se
representa como `''`. Se permiten identificadores entre acentos graves y
comentarios de línea `--`.

## Seguridad y compatibilidad

El archivo SQL **no se ejecuta** en MySQL. Un analizador de gramática cerrada
solo admite `CREATE TABLE` e `INSERT INTO` de las tablas y columnas anteriores.
Se rechazan `DROP`, `ALTER`, `SELECT`, funciones, expresiones, comentarios de
bloque, columnas distintas, JSON inválido, firmas incorrectas y archivos
parciales.

También se admite un archivo reducido que contenga únicamente `usuarios`; en
ese caso se crean o actualizan usuarios mediante las validaciones normales y
no se reemplazan las otras colecciones. Para una restauración completa debe
usarse el archivo generado por **Exportar base actual**.

No se exportan contraseñas, hashes, sales, sesiones ni secretos. Los perfiles
de cuentas se conservan sin credenciales y, al restaurar sobre la misma
instalación, las credenciales existentes se mantienen cuando corresponden.

MIME admitidos: `application/sql`, `application/x-sql`, `text/sql`,
`text/x-sql`, `text/plain` y `application/octet-stream`. Este último cubre
archivos `.sql` que Windows o el navegador no identifican con un MIME más
específico.

Endpoints:

- `POST /api/users/import-sql`
- `GET /api/users/export-sql`

Pruebas: `npm run test:sql` y `npm test`.
