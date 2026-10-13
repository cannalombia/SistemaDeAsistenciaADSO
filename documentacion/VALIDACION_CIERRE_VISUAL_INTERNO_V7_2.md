# Validación — cierre visual interno posterior a v7.1

## Alcance

Esta entrega modifica únicamente presentación y pruebas asociadas al sistema visual. No cambia endpoints, persistencia, MySQL, roles, autenticación, reglas de negocio ni lógica QR.

## Comprobaciones aprobadas en esta entrega

- `node pruebas/prueba_sistema_visual.js` — **OK**.
- `node pruebas/prueba_sidebar_visual.js` — **OK**.
- `node pruebas/prueba_tema_usuarios_estadisticas.js` — **OK**.
- `node pruebas/prueba_estadisticas_frontend.js` — **OK**.
- `node pruebas/prueba_estadisticas_analitica.js` — **OK**.
- `node pruebas/prueba_qr_frontend.js` — **OK** (incluye un error simulado esperado dentro de la prueba negativa).
- Comprobación de sintaxis de los JavaScript modificados/pruebas — **OK**.

## Suite completa

En el entorno de construcción de esta entrega, `npm ci` no pudo completarse porque no hay acceso al registro externo de paquetes. Por ello `npm test` no pudo arrancar al faltar `nodemailer` en `node_modules`. Esto es una limitación del entorno de empaquetado, no un fallo detectado del código.

Antes de reemplazar la versión estable local, ejecutar en el PC del proyecto:

```powershell
npm ci
npm test
```

La entrega incluye `pruebas/prueba_sistema_visual.js` integrada en `npm test`.

## Validación visual manual pendiente

La aprobación definitiva debe hacerse con evidencia antes/después en:

- 1366x768, claro y oscuro.
- 390x844, claro y oscuro cuando aplique.

Especialmente: Fichas, Horarios, Ambientes, Programas, Configuración, Asistencia, Aprendiz y Login. Crear usuario y Estadísticas conservan sus estilos especializados ya validados.
