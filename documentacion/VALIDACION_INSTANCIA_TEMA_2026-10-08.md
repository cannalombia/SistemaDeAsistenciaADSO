# Validación final — modo oscuro e instancia activa

Fecha: 2026-10-08

## Causa real encontrada

El problema no era únicamente de CSS. El lanzador `ABRIR_PROYECTO.cmd` usa `herramientas/automatizacion/asegurar_servidor.ps1` y el supervisor aceptaba cualquier instancia saludable de Blue Magic que ya estuviera escuchando en `localhost:3000`.

Si una versión anterior estaba activa desde otra carpeta, el script terminaba con éxito y el navegador seguía recibiendo los HTML/CSS de esa copia antigua. Esto explicaba que los ZIP nuevos contuvieran el tema oscuro corregido y, aun así, en pantalla continuaran apareciendo paneles blancos.

## Corrección aplicada

- Se añadió `BUILD_ID.txt` con el identificador `2026-10-08-dark-theme-instance-v4`.
- `/api/health` ahora devuelve `buildId`.
- `asegurar_servidor.ps1` comprueba simultáneamente:
  - que el proceso Node que ocupa el puerto 3000 pertenece a la carpeta actual;
  - que el `buildId` servido coincide con el paquete actual.
- Si detecta Blue Magic de otra carpeta o una versión anterior, detiene esa instancia y arranca `servidor/servidor.js` desde la carpeta actual.
- `ABRIR_PROYECTO.cmd` informa que está verificando la carpeta y versión activas.

## Verificación visual del tema

Se renderizó `crear_usuario.html` con el modo oscuro activo y se comprobaron estilos calculados:

- Importación CSV: fondo oscuro y texto claro.
- Directorio: fondo oscuro y texto claro.
- Tabla: celdas `rgb(23, 39, 47)` y texto `rgb(220, 232, 236)`.
- Inputs del formulario: `rgb(18, 34, 41)` y texto `rgb(239, 245, 247)`.
- Selects del formulario: `rgb(18, 34, 41)` y texto `rgb(239, 245, 247)`.
- Etiquetas: texto `rgb(210, 221, 225)`.
- Fecha/hora y notificaciones conservan sus reglas de contraste oscuro.

Captura de evidencia: `documentacion/evidencias/tema_oscuro_crear_usuario_verificado.png`.

## Pruebas ejecutadas

- `node --check` sobre JavaScript de aplicación, servidor, herramientas y pruebas: OK.
- `node pruebas/prueba_tema_usuarios_estadisticas.js`: OK.
- `node pruebas/prueba_sidebar_visual.js`: OK.
- `node pruebas/prueba_qr_frontend.js`: OK.
- `node pruebas/prueba_estadisticas_frontend.js`: OK.
- `node pruebas/prueba_estadisticas_analitica.js`: OK.

## Forma correcta de abrir esta entrega

Usar `ABRIR_PROYECTO.cmd` desde esta carpeta. El supervisor ya no reutiliza silenciosamente una copia antigua de Blue Magic.
