# Presentación del Sistema de Asistencia SENA

## Objetivo

Registrar la asistencia de aprendices, consultar resultados por ficha y periodo,
y generar informes que el personal pueda descargar y presentar a coordinación.
El proyecto se ejecuta localmente con Node.js y una interfaz HTML, CSS y JavaScript.

## Preparación de la demostración

1. Abre la carpeta completa del proyecto en Visual Studio Code.
2. Comprueba que Node.js 18 o posterior y npm estén instalados.
3. Si es una instalación nueva, ejecuta `npm.cmd ci` para instalar las versiones
   definidas en `package-lock.json`.
4. Abre `ABRIR_PROYECTO.cmd` o ejecuta `npm.cmd start`.
5. Entra en [la pantalla de acceso](http://localhost:3000/login.html).
6. Usa una cuenta configurada en el equipo. La recuperación administrativa se
   realiza con `npm.cmd run reset:admin`; no requiere borrar los demás datos.

Para presentar desde este computador no necesitas reinstalar las dependencias
ni reemplazar la configuración existente. El acceso mediante código al correo
requiere configurar el proveedor, según la guía de correo de esta carpeta.

## Recorrido recomendado

| Pantalla | Qué mostrar |
| --- | --- |
| Acceso | Inicio de sesión y separación de roles. |
| Usuarios | Directorio, creación, edición e importación. |
| Asistencia | Selección de ficha, fecha y jornada; estados y observaciones; guardado. |
| Estadísticas | Filtros por fechas y ficha, evolución diaria y resumen por aprendiz. |
| Reportes guardados | Consulta del corte histórico y descarga de su PDF. |

La asistencia es el registro diario editable. Estadísticas analiza los registros
guardados durante un periodo y conserva informes. Son funciones diferentes.
Para demostrar modificaciones de asistencia, usa registros de práctica claramente
identificados; no es necesario alterar la asistencia real del grupo.

## Cómo explicar la estructura

| Carpeta | Responsabilidad | ¿Se usa para ejecutar el sistema? |
| --- | --- | --- |
| `aplicacion/` | Pantallas, estilos, imágenes y JavaScript del navegador. | Sí. |
| `servidor/` | API, autenticación, reglas, correo y PDF. | Sí. |
| `base_datos/` | SQL de referencia y migraciones versionadas de MySQL. | Sí, para instalación y cambios de esquema. |
| `datos/` | Ejemplos y archivos legacy/locales excluidos de la entrega pública. | No como persistencia operacional. |
| `node_modules/` | Dependencias instaladas por npm. | Sí; se recrea con `npm.cmd ci`. |
| `herramientas/` | Inicio automático y recuperación del proceso en Windows. | Se usa al abrir mediante el acceso Windows. |
| `pruebas/` | Comprobaciones automáticas. | Para validar, no para servir las páginas. |
| `documentacion/` | Guías, decisiones técnicas y referencias. | Material de consulta. |
| `respaldos/` | Versiones anteriores y evidencias de revisión. | No; no se carga ni se publica por el servidor. |

`package.json` define las dependencias y comandos; `package-lock.json` fija sus
versiones. Ambos son necesarios. El directorio `.vscode` conserva la opción F5;
`.git` mantiene el historial. No son archivos sobrantes.

Hay dos archivos `index.html` con propósitos distintos: el de la raíz permite
abrir el proyecto desde el explorador; el de `aplicacion/paginas HTML/` mantiene la
entrada web y envía al panel correspondiente a la sesión. Ya no contiene una
segunda pantalla de estadísticas.

La biblioteca `servidor/vendor/pdf-lib.min.js` permite generar PDF sin descargar
recursos externos. Su licencia se conserva junto al archivo.

## Comprobaciones

Ejecuta `npm.cmd test`. Se comprueban recursos y sintaxis, validaciones, acceso,
usuarios, programas, asistencia e informes. Las pruebas de reportes validan
filtros, permisos, PDF de varias páginas y conservación del corte después de
modificar datos y reiniciar. Los mensajes de fecha o jornada inválida durante
las pruebas corresponden a solicitudes incorrectas enviadas intencionalmente;
la ejecución termina con `OK` si esas solicitudes se rechazan correctamente.

`npm.cmd run status` permite confirmar que el servidor está activo.

## Alcance actual

La aplicación guarda la información operativa en MySQL y requiere una instancia
configurada para iniciar. `DATA_SOURCE=mysql` es el modo definitivo. Los CSV y
JSON se conservan como respaldo legacy y las muestras de `datos/ejemplos/`
permiten documentar formatos sin publicar datos reales.

La configuración privada de MySQL, correo y cuentas integradas vive en `.env` o
archivos locales ignorados. Las credenciales, los datos
personales, informes y respaldos operativos no forman parte de una entrega pública
del código. En una copia nueva se proporcionan los archivos de `datos/ejemplos/`.
Una instalación en otro computador necesita sus propias dependencias y configuración.

El detalle técnico y las limitaciones se amplían en
`../arquitectura/2026-08-22_arquitectura_actual.md`.
