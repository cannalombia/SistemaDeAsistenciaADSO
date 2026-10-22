# BUG-03 · Sidebar blanca en vistas internas

## Descripcion
La barra lateral podia verse blanca o inconsistente por estilos compartidos y versiones de cache desalineadas.

## Reproduccion
1. Abrir sucesivamente Estadisticas, Asistencia, Usuarios y Configuracion con recursos de cache previos.
2. Alternar tema claro/oscuro y ancho movil/escritorio.
3. Comparar fondo y espacio reservado de la navegacion.

## Esperado
Todas las vistas usan el fondo local institucional, el mismo ancho y contraste legible.

## Actual
En la version afectada algunas vistas mostraban fondo blanco o un espacio lateral distinto.

## Validacion preparada
Las pruebas de sidebar, sistema visual y tema verifican imagen local, ancho uniforme y reglas oscuras. Se conserva una revision manual final en Edge/Chrome.
