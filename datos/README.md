# Datos del sistema

Esta carpeta contiene información que la aplicación lee o actualiza. No todos
los archivos tienen el mismo propósito.

## Archivos operativos

- `aprendices.json`: perfiles y datos académicos de aprendices.
- `asistencia.json`: registros de asistencia guardados por la aplicación.
- `usuarios_gestionados.json`: usuarios creados desde la interfaz.
- `importaciones/usuarios_activos.csv`: directorio activo que también puede
  editarse mediante la gestión de usuarios.

Conviene hacer una copia antes de reemplazar cualquiera de estos archivos.
Estos archivos son locales y Git no los publica porque pueden contener datos
personales.

## Datos de ejemplo

`ejemplos/` contiene un aprendiz ficticio, un registro de asistencia y un CSV
pequeño. Cuando una copia nueva del proyecto no tiene archivos operativos, el
servidor crea esos archivos a partir de las muestras. Así el proyecto puede
iniciar sin publicar la información real del grupo.

## Fuentes de importación

- `importaciones/2026-08-07_usuarios_originales.xlsx`: fuente original
  conservada como referencia.
- `importaciones/2026-08-07_formato_asistencia.csv`: ejemplo del formato de
  carga.

## Archivos privados generados en ejecución

El servidor puede crear credenciales administrativas, una clave para proteger
códigos, estado de solicitudes e historial de entregas. Esos archivos están en
`.gitignore`; no deben copiarse a un repositorio público ni enviarse por chat.

Los códigos de acceso vencen y no se almacenan como texto visible. El historial
de correo usa direcciones enmascaradas.
