# Importación SQL y exportación

En **Crear Usuario → Archivo SQL** se puede subir un archivo UTF-8 de hasta
1 MB (1048576 bytes). El formulario envía multipart/form-data con el campo
`SQLFILE`; la API también acepta `file` como alias. Busboy procesa la subida
con límites de tamaño y número de archivos. No se almacena el archivo subido.

La API valida la extensión `.sql` y admite exclusivamente los MIME
`application/sql`, `application/x-sql`, `text/sql`, `text/x-sql` y `text/plain`.
Si Windows no asigna MIME, el formulario declara `application/sql`.
El backend verifica además UTF-8 y la gramática SQL completa.

Se admiten INSERT INTO usuarios con estas siete columnas, con o sin lista
explícita de columnas. Los valores deben ser literales entre comillas simples;
un apóstrofo interno se representa como `''`. Ejemplo:

```sql
INSERT INTO usuarios (identificacion, tipo_documento, nombre, correo, rol, estado, ficha)
VALUES ('800000123', 'Cédula de Ciudadanía', 'María Pérez', 'maria@example.com', 'instructor', 'activo', '');
```

Opcionalmente puede aparecer CREATE TABLE usuarios con esas siete columnas,
en ese orden, todas de tipo TEXT. Se permiten comentarios de línea `--`.
Se rechazan instrucciones destructivas, funciones, expresiones, otras tablas
y sintaxis no soportada. No se ejecuta SQL arbitrario: se transforma a registros
validados y se aplica el importador existente, que verifica roles, documentos,
correos, duplicados y cuentas protegidas antes de guardar.

La operación conserva los permisos existentes de administrador/coordinador.
Endpoints: POST `/api/users/import-sql` y GET `/api/users/export-sql`.

**Exportar base actual** descarga exactamente `Base_datos_SENA.sql`, sin límite
de 1 MB para la descarga. Incluye todos los usuarios de la base CSV principal,
con sus roles, y las colecciones vigentes de ambientes, fichas, horarios,
programas, aprendices, asistencia, reportes y perfiles de cuentas.
Las colecciones con estructuras anidadas se conservan en columnas `datos_json`.
No incluye contraseñas, hashes, sesiones ni secretos de autenticación.
Utiliza literales SQL estándar y se puede cargar en SQLite; no es un respaldo
de credenciales ni un restaurador completo de la aplicación.

La pestaña importa únicamente usuarios: un dump completo con otras tablas o
de más de 1 MB no se puede subir directamente. El archivo generado en
`base_datos/Base_datos_SENA.sql` es una instantánea; el botón genera una nueva
con los datos vigentes en cada descarga.

Pruebas: `npm run test:sql` y `npm test`.
