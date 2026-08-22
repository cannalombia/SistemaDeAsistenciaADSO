# Arquitectura actual

Este documento explica cómo está armado el proyecto hoy. No intenta vender una
arquitectura perfecta: señala qué está separado, dónde viven los datos y qué
trabajo todavía conviene hacer.

## Recorrido de una solicitud

1. El navegador abre una página de `aplicacion/paginas`.
2. `autenticacion.js` comprueba la sesión y protege las páginas internas.
3. `navegacion.js` construye el menú correspondiente al rol. Así el menú no se
   copia en cada HTML.
4. Los scripts de cada pantalla consultan la API con `fetch`.
5. `servidor/servidor.js` resuelve la ruta, valida la sesión y coordina el caso
   de uso.
6. Los módulos de dominio normalizan y validan programas, usuarios y rangos de
   estadísticas.
7. La persistencia escribe los archivos operativos. El servicio de correo se
   ocupa de la cola, los reintentos, el proveedor y el historial de entregas.

## Responsabilidades

### Navegador

- `aplicacion/paginas`: estructura de cada pantalla.
- `aplicacion/recursos/scripts/navegacion.js`: menú común, estado activo y
  comportamiento móvil.
- `aplicacion/recursos/scripts/datos_demostracion.js`: datos de muestra
  identificados como tales. No se confunden con registros reales.
- `aplicacion/recursos/scripts/asistencia.js` y `estadisticas.js`: lógica
  específica de esas pantallas.
- `aplicacion/recursos/scripts/programas.js`: filtros y operaciones del
  directorio de programas.
- `aplicacion/recursos/scripts/script.js`: CRUD real de usuarios, acompañado de
  comentarios que explican los comandos trabajados en clase.
- `aplicacion/recursos/estilos/estilos_generales.css`: punto de entrada de los
  estilos. Importa archivos más pequeños sin alterar el orden de la cascada.

### Servidor

- `servidor/servidor.js`: composición de la aplicación, sesiones, permisos,
  rutas y coordinación de los casos de uso.
- `servidor/configuracion/rutas.js`: ubicaciones físicas del proyecto.
- `servidor/modulos/correo.js`: Gmail/Resend, plantilla del código, cola,
  pausas, reintentos y revisión del proveedor.
- `servidor/modulos/persistencia.js`: JSON, CSV y lectura del SQL de referencia.
- `servidor/modulos/utilidades.js`: funciones pequeñas sin estado.
- `servidor/dominio`: reglas y normalización propias del negocio.

### Datos

La aplicación todavía usa archivos JSON y CSV como almacenamiento. Para una
instalación local o una demostración controlada es una decisión práctica: no
obliga a instalar una base de datos adicional y permite revisar los registros
con herramientas comunes. Para varios servidores o muchas escrituras
simultáneas ya no sería suficiente; en ese escenario habría que migrar a una
base de datos transaccional.

La guía de `datos/README.md` indica qué archivos son operativos, cuáles son
fuentes de importación y cuáles nunca se deben publicar.

El repositorio solo guarda muestras anónimas. En el primer inicio, si faltan los
archivos operativos, el servidor los crea a partir de `datos/ejemplos`. Los
datos reales y los respaldos permanecen en el computador y están excluidos de
Git.

## Correo y disponibilidad

El servidor evita solicitudes simultáneas para el mismo documento, limita la
frecuencia por hora y pone las entregas en una cola. Los errores temporales se
reintentan con una espera progresiva. Además, conserva un historial técnico y
consulta periódicamente el estado del proveedor.

Estas protecciones evitan duplicados y reducen la saturación, pero no convierten
un proveedor externo en infalible. Resend en modo de prueba solo permite ciertos
destinatarios. Para correo real se necesita un dominio verificado o una cuenta
de Gmail configurada con contraseña de aplicación.

## Deuda conocida

- `servidor/servidor.js` sigue concentrando varios controladores HTTP. Ya no
  contiene persistencia, correo ni reglas básicas de dominio, pero los
  controladores de usuarios y asistencia se pueden extraer en una siguiente
  etapa.
- `aplicacion.js` conserva la infraestructura común y funciones pequeñas para
  fichas, horarios, ambientes, ajustes y portal del aprendiz. Fichas, horarios
  y ambientes son los siguientes candidatos si esas pantallas siguen creciendo.
- JSON y CSV no resuelven concurrencia entre varias máquinas.
- Las pruebas cubren recorridos principales y reglas puras, no una prueba visual
  automática en todos los navegadores.

Registrar estos límites evita aparentar una madurez que el proyecto todavía no
tiene y deja claro por dónde continuar.
