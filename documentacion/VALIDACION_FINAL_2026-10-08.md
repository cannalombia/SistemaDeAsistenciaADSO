# Validación final — 08/10/2026

## Alcance verificado

- Sintaxis JavaScript completa con `node --check` sobre aplicación, servidor, herramientas y pruebas.
- Archivos JSON del paquete parseados correctamente.
- Navegación lateral compartida presente en los ocho módulos del personal.
- CSS del sidebar y `sidebar_campus_20261008.png` servidos correctamente por las rutas reales del servidor.
- Banner de Estadísticas y carga automática del último corte verificados por prueba frontend.
- Analítica interactiva verificada por su prueba específica.
- QR frontend verificado con ocho fichas.
- Servidor verificado para exponer exactamente las fichas operativas `3349882`–`3349889` y generar QR para `3349889`; la histórica `3349881` permanece fuera del catálogo QR diario.
- Compatibilidad de `calcular_extremos` recuperada y prueba histórica aprobada.
- Suite completa de pruebas ejecutada en un harness aislado con sustitutos locales únicamente para las cuatro dependencias npm que no estaban disponibles para descargar en el entorno de empaquetado (`qrcode`, `nodemailer`, `mysql2`, `busboy`). Todas las pruebas finalizaron con código 0.

## Importante para la máquina de entrega

El ZIP conserva `package-lock.json` y no incluye `node_modules`, como corresponde a un paquete de código limpio. En el PC del proyecto, con acceso normal al registro npm y MySQL configurado, ejecutar:

```bash
npm ci
npm test
```

`ABRIR_PROYECTO.cmd` también contempla instalar dependencias cuando `node_modules` no existe.

## Resultado

Los cambios realizados en esta entrega no presentan errores de sintaxis ni fallos en las pruebas específicas o en la suite lógica ejecutada. La única comprobación que este entorno no puede sustituir es una ejecución final con las dependencias npm reales y la instancia MySQL real de la máquina del proyecto; por eso ese paso queda explícitamente indicado antes de publicar el commit definitivo.
