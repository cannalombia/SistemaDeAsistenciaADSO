# Validación local de MySQL

## Estado

Se validó el funcionamiento local del sistema utilizando MySQL como fuente de datos.

## Comprobaciones realizadas

- MySQL activo y disponible.
- Migraciones aplicadas correctamente.
- Validación de corte sin diferencias.
- MySQL activado como fuente definitiva.
- `DATA_SOURCE=mysql`.
- `/api/health` responde con estado `ready`.
- Inicio de sesión administrativo funcional.
- Carga correcta de estadísticas, asistencia, usuarios, programas, fichas, horarios, ambientes y configuración.

## Ejecución local

Con MySQL iniciado:

```bash
npm.cmd start

Acceso local:
http://localhost:3000/login.html

Health check:
http://localhost:3000/api/health