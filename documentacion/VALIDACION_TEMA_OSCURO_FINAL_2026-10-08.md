# Validación final — modo oscuro Crear usuario

Fecha: 8 de octubre de 2026

## Problema reproducido

Las capturas reales mostraban una aplicación parcial del modo oscuro en `crear_usuario.html`:

- el fondo general cambiaba a oscuro;
- las tarjetas superiores sí adoptaban parte del tema;
- el panel de importación CSV permanecía blanco;
- el directorio y la tabla permanecían blancos;
- el formulario tenía contenedor oscuro, pero `input` y `select` seguían claros;
- varios textos y etiquetas perdían contraste;
- el indicador de fecha/hora y la campana de notificaciones permanecían visualmente claros.

## Causa corregida

La solución anterior dependía de una hoja de refuerzo externa. Para evitar que el orden de carga, la caché o reglas posteriores de la cascada vuelvan a imponer superficies claras, `crear_usuario.html` incluye ahora un bloque final de tema oscuro con selectores específicos e `!important` únicamente para los componentes afectados.

Se conserva además `tema_oscuro_modulos_20261008.css` como refuerzo compartido y se actualizó su parámetro de versión.

## Componentes cubiertos

- fondo principal de Crear usuario;
- título y descripción del encabezado;
- fecha/hora `Actualizado ...`;
- campana y contador de notificaciones;
- diálogo/listado de notificaciones;
- tres tarjetas de resumen;
- pestañas Archivo CSV / Archivo SQL;
- panel de importación CSV;
- panel de importación SQL;
- selector de archivo y botones de importación;
- directorio de usuarios;
- buscador;
- encabezado, filas y celdas de la tabla;
- nombres, correo, documento y ficha;
- badges de rol y estado;
- botones de editar/cambiar estado/eliminar;
- panel Información del usuario;
- etiquetas del formulario;
- inputs, selects, opciones y placeholders;
- autofill de Chromium;
- botón Guardar Usuario.

## Funcionalidad conservada

- `usuarios.js` continúa actualizando la fecha y hora con `new Date().toLocaleString("es-CO")` después de sincronizar los usuarios.
- `aplicacion.js` conserva la consulta de `/api/notifications`, el contador y la apertura del diálogo de notificaciones.
- no se modificaron endpoints, datos, roles, QR, formación ni lógica de asistencia.
- la imagen `sidebar_campus_20261008.png` continúa en la barra lateral izquierda.

## Pruebas ejecutadas

Aprobadas:

- `node pruebas/prueba_tema_usuarios_estadisticas.js`
- `node pruebas/prueba_sidebar_visual.js`
- `node pruebas/prueba_estadisticas_frontend.js`
- `node pruebas/prueba_estadisticas_analitica.js`
- `node pruebas/prueba_qr_frontend.js`
- `node --check` de `usuarios.js`, `aplicacion.js` y la prueba de tema.
- análisis CSS con `tinycss2`: 0 errores de parseo en `base.css`, `tema_oscuro_modulos_20261008.css`, `estadisticas_usuarios.css` y el hotfix inline.
- renderización estática de comprobación: paneles, tabla, formulario, inputs y selects resultaron oscuros con texto visible.

`npm test` completo no se declaró aprobado en este entorno porque el ZIP final no incluye `node_modules` y la instalación temporal de dependencias quedó incompleta (`nodemailer` no disponible). Esto no corresponde a un fallo del cambio visual. En el equipo del proyecto, después de `npm ci`, debe ejecutarse `npm test` antes del push definitivo.

## Resultado

**CORRECCIÓN VISUAL APROBADA EN EL ALCANCE VALIDADO.**

El modo oscuro de Crear usuario ya no depende exclusivamente de la hoja de refuerzo externa: los componentes que en las capturas permanecían blancos cuentan con una regla final dentro de la propia vista.
