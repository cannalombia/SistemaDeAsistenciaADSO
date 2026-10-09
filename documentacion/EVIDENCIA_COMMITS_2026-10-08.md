# Evidencia de cambios y plan de commits — 08/10/2026

Proyecto: Sistema web de control de asistencia — Blue Magic V5
Objetivo: dejar evidencia separada para que Codex realice commits claros en el repositorio Git real, sin mezclar cambios funcionales y visuales.

## Estado del paquete

Este ZIP de entrega no contiene `.git`, por lo tanto aquí no se crean hashes ni se simulan commits. Los mensajes y grupos siguientes son la guía de staging para ejecutar sobre la carpeta que sí está conectada al repositorio `SistemaDeAsistenciaADSO`.

## Commit A — banner y último corte automático

Mensaje sugerido:

```text
feat: integrar analítica y cargar automáticamente el último corte
```

Evidencia funcional:

- Estadísticas abre con los últimos registros guardados sin obligar al administrador a seleccionar un periodo.
- El banner consume datos reales del dashboard.
- Se conservan recuperación de `fetch`, analítica interactiva, responsive y modo oscuro.
- Se recuperó `calcular_extremos` para mantener compatibilidad con la prueba histórica y manejar conjuntos grandes sin expansión de argumentos.

Archivos principales ya relacionados con este avance:

```text
aplicacion/paginas HTML/estadisticas.html
aplicacion/recursos/JS scripts/estadisticas.js
aplicacion/recursos/JS scripts/estadisticas_analitica.js
aplicacion/recursos/JS scripts/estadisticas_informes.js
aplicacion/recursos/estilos CCS/estadisticas_reportes.css
aplicacion/recursos/estilos CCS/paneles_academicos.css
pruebas/prueba_estadisticas_frontend.js
pruebas/prueba_estadisticas_analitica.js
INFORME_ANALITICA_2026-10-08.md
```

## Commit B — rediseño de módulos / navegación lateral

Mensaje sugerido:

```text
feat: rediseñar navegación lateral de módulos con identidad Blue Magic
```

Qué se corrigió:

- El diseño no se duplicó en ocho HTML distintos; se aplicó en la navegación compartida.
- Estadísticas, Asistencia, Crear usuario, Programa de formación, Fichas, Horario, Ambientes y Configuración reciben el nuevo sidebar.
- Se integró el fondo vertical del campus con base `#003B5C`.
- Los módulos usan tarjetas, bordes tecnológicos, estado activo y chevrón.
- Cerrar sesión adopta el mismo lenguaje visual.

Archivos para staging:

```text
aplicacion/recursos/estilos CCS/navegacion_aprendiz.css
aplicacion/recursos/JS scripts/autenticacion.js
aplicacion/recursos/imagenes/sidebar_campus_20261008.png
pruebas/prueba_sidebar_visual.js
package.json
MEJORAS_HOY_2026-10-08.md
documentacion/EVIDENCIA_COMMITS_2026-10-08.md
```

Validación específica:

```text
node pruebas/prueba_sidebar_visual.js
```

## Commit C — QR para las ocho fichas operativas

Mensaje sugerido:

```text
fix: habilitar QR para las ocho fichas operativas
```

Qué se corrigió:

- El catálogo QR ya no depende exclusivamente de que existan aprendices activos cargados para descubrir una ficha.
- Se toman primero las fichas activas configuradas en formación.
- Las ocho fichas operativas son `3349882` a `3349889`.
- La ficha `3349881` sigue preservada como histórica, pero no se mezcla con el catálogo QR diario.
- Se conserva la compatibilidad con importaciones que traigan una ficha válida desde el perfil de un aprendiz.

Archivos para staging:

```text
servidor/servidor.js
pruebas/prueba_qr_frontend.js
pruebas/prueba_escala.js
MEJORAS_HOY_2026-10-08.md
```

Validación específica disponible sin levantar MySQL:

```text
node pruebas/prueba_qr_frontend.js
```

Validación integral en el PC del proyecto, con dependencias y MySQL activos:

```text
npm ci
npm test
```

## Evidencia histórica — corrección #12, ficha 3349881

Referencia del historial existente: **12. COMMIT — CORRECCIÓN DE FICHA HISTÓRICA 3349881**.

Problema identificado:

- La ficha `3349881` se había interpretado como dato inválido, pero correspondía a una ficha histórica que debía mantenerse.

Solución documentada:

- Se restauró `3349881` en formación.
- No se movieron aprendices.
- No se modificaron asistencias.
- Se conservaron los 14 aprendices relacionados.
- La validación quedó en **0 relaciones rotas**.

Mensaje de commit histórico recomendado para la evidencia, solo si ese cambio todavía no existe como commit en el repositorio actual:

```text
fix: preservar ficha histórica 3349881 y sus relaciones
```

No se debe volver a aplicar ni duplicar la corrección si Git ya contiene ese commit; en ese caso este bloque sirve únicamente como evidencia para GitHub y sustentación.

## Secuencia recomendada para Codex

Antes de crear commits, ejecutar:

```bash
git status -sb
git diff --check
```

Luego hacer staging por grupos, revisar `git diff --cached` y crear cada commit con uno de los mensajes anteriores. Al terminar:

```bash
git status -sb
git log --oneline --decorate -8
```

No usar `git push --force` en el flujo normal de colaboración.
