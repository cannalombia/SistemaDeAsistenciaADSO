# Datos del sistema

Esta carpeta contiene información que la aplicación lee o actualiza. No todos
los archivos tienen el mismo propósito.

## Archivos operativos

- `aprendices.json`: perfiles y datos académicos de aprendices.
- `asistencia.json`: registros de asistencia guardados por la aplicación.
- `reportes_estadisticas.json`: informes históricos con los datos de cada corte.
- `formacion.json`: fuente central de fichas, horarios y ambientes. Las tres
  pantallas y los cálculos de asistencia consultan este mismo archivo por la API.
- `auditoria.json`: bitácora de acciones administrativas y cambios de asistencia,
  con actor, fecha y valores anteriores y posteriores. Se conserva un máximo de
  5000 entradas y solo administradores o coordinadores pueden consultarla.
- `usuarios_gestionados.json`: credenciales de cuentas con contraseña y datos auxiliares.
- `../usuarios_listo_para_importar.csv`: base principal de usuarios, ubicada en la raíz
  del proyecto. Crear, editar, importar y eliminar desde la app actualiza este archivo.
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

Los archivos de `importaciones/originales/` se conservan como fuentes; el servidor
lee `../usuarios_listo_para_importar.csv` como directorio principal de usuarios.
Los cambios externos se leen en la siguiente consulta a la API, sin reiniciar.
