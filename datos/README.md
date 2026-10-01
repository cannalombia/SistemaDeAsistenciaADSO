# Datos del sistema

Esta carpeta contiene información que la aplicación lee o actualiza. No todos
los archivos tienen el mismo propósito.

## Archivos legacy privados

MySQL es la persistencia operacional definitiva. Los siguientes archivos se
conservan para respaldo, auditoría histórica o rollback controlado; no son la
fuente activa cuando `DATA_SOURCE=mysql`:

- `aprendices.json`: perfiles y datos académicos de aprendices.
- `asistencia.json`: registros de asistencia guardados por la aplicación.
- `reportes_estadisticas.json`: informes históricos con los datos de cada corte.
- `formacion.json`: copia legacy de fichas, horarios y ambientes.
- `auditoria.json`: bitácora de acciones administrativas y cambios de asistencia,
  con actor, fecha y valores anteriores y posteriores. Se conserva un máximo de
  5000 entradas y solo administradores o coordinadores pueden consultarla.
- `usuarios_gestionados.json`: copia legacy de cuentas gestionadas y datos auxiliares.
- `../usuarios_listo_para_importar.csv`: directorio legacy de usuarios conservado
  fuera del repositorio.
- `importaciones/usuarios_activos.csv`: archivo anterior; solo se usa para migrar
  cuando todavía no existe la base principal al iniciar.

Conviene hacer una copia antes de reemplazar cualquiera de estos archivos.
Estos archivos son locales y Git no los publica porque pueden contener datos
personales.

## Datos de ejemplo

`ejemplos/` contiene un aprendiz ficticio, un registro de asistencia y un CSV
pequeño. Cuando una copia nueva del proyecto no tiene archivos operativos, el
servidor crea esos archivos a partir de las muestras. Así el proyecto puede
iniciar sin publicar la información real del grupo.

## Fuentes de importación

- `importaciones/originales/2026-08-07_usuarios_originales.xlsx`: fuente original
  conservada como referencia.
- `importaciones/originales/2026-08-07_formato_asistencia.csv`: ejemplo del formato de
  carga.

## Archivos privados generados en ejecución

El servidor puede crear credenciales administrativas, una clave para proteger
códigos, estado de solicitudes e historial de entregas. Esos archivos están en
`.gitignore`; no deben copiarse a un repositorio público ni enviarse por chat.

Los códigos de acceso vencen y no se almacenan como texto visible. El historial
de correo usa direcciones enmascaradas.

Los archivos de `importaciones/originales/` y
`../usuarios_listo_para_importar.csv` se conservan como fuentes legacy privadas.
La aplicación activa consulta MySQL.
