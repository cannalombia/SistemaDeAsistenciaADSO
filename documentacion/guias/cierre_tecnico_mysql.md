# Cierre técnico MySQL

MySQL solo se considera fuente definitiva cuando `app_settings.source_definitive` vale `mysql`. El servidor comprueba esa marca antes de abrir el puerto, por lo que una importación incompleta nunca deja el sistema arrancado parcialmente.

## Preparación

1. Crea una base real y otra de pruebas, ambas con `utf8mb4`/`utf8mb4_unicode_ci`.
2. Crea el usuario exclusivo y la cuenta separada de migraciones siguiendo `base_datos/crear_usuario_aplicacion.sql.example`. Node usa únicamente la cuenta con permisos DML mínimos; no uses `root`.
3. Copia `.env.example` a `.env`, completa las variables `DB_*` y conserva temporalmente `DATA_SOURCE=legacy`.
4. Ejecuta `npm run db:migrate`.

Las migraciones aplicadas se registran con versión y SHA-256 en `schema_migrations`. Si se altera una migración ya aplicada, el proceso falla de forma explícita.

## Importación y comparación

Ejecuta `npm run db:cutover`. Este comando:

- valida primero las relaciones en CSV/JSON;
- importa todas las colecciones en una transacción;
- compara conteos, contenido, usuarios/roles y relaciones;
- deja MySQL sin activar, incluso si la comparación resulta correcta.

Puede repetirse mientras los archivos sigan siendo la fuente. `npm run db:validate` compara sin volver a importar.

## Lista funcional obligatoria

Con una base de pruebas independiente (`NODE_ENV=test` y `DB_NAME_TEST` distinto de `DB_NAME`), verifica:

- conteos y relaciones;
- usuarios y roles;
- login de administrador, instructor y aprendiz;
- registro manual de asistencia;
- generación y lectura de QR;
- generación y descarga de un reporte;
- consulta de auditoría;
- exportación de respaldo, cambio controlado y restauración del respaldo.

Solo después de aprobar todo ejecuta `npm run db:activate`, cambia `DATA_SOURCE=mysql` y reinicia. `/api/health` debe devolver `database.source=mysql`, `ready=true`, charset `utf8mb4` y la collation negociada.

## Respaldo y restauración

El endpoint administrativo existente exporta el estado que el servidor cargó desde MySQL e identifica en el respaldo la fuente, charset, collation y zona horaria. Al restaurar, valida el archivo, crea el respaldo automático previo y confirma todas las tablas MySQL en una sola transacción. CSV/JSON no intervienen cuando `DATA_SOURCE=mysql`.

## Rollback seguro

Detén el servidor y ejecuta `npm run db:rollback`. Antes de retirar las tablas de aplicación, el comando crea `respaldos/rollback/Pre_rollback_mysql_*.json`, desactiva la marca de corte y ejecuta la migración `down`. Luego establece `DATA_SOURCE=legacy` para volver temporalmente a los archivos originales.

El rollback no elimina la tabla `schema_migrations`; conserva el historial técnico y permite aplicar de nuevo el esquema.
