# Cierre visual interno posterior a v7.1

> **Nomenclatura:** el proyecto académico continúa documentándose como **V5**. `v7.2` se usa únicamente como referencia interna de esta iteración visual y no reemplaza la numeración académica.

## Alcance aplicado

- Sistema visual compartido mediante `sistema_visual.css`.
- Archivo nuevo en minúscula e importado desde `estilos_generales.css`.
- Tokens comunes para color, espacios, radios, sombras, alturas y transiciones.
- Botones, controles, paneles, tablas, badges, estados y modales con una base común.
- Foco visible y controles táctiles de al menos 44 px como referencia de accesibilidad.
- Responsive base para escritorio y móvil.
- Modo oscuro genérico para módulos que usan `ui-v72`; Crear usuario y Estadísticas conservan su refuerzo especializado.
- Ajuste visual de Fichas, Horarios, Ambientes, Programas, Configuración, Asistencia, Aprendiz, Login y entrada del sistema.
- No se modifican endpoints, reglas de negocio, validaciones, persistencia, MySQL, roles ni lógica QR.

## Evidencia técnica

- `pruebas/prueba_sistema_visual.js` valida la importación, la convención en minúsculas, tokens, estados UI y clases de página.
- `BUILD_ID.txt` diferencia esta entrega visual de copias anteriores para evitar que `localhost:3000` reutilice una instancia vieja.

## Pendiente de validación manual

La aprobación visual definitiva requiere capturas en modo claro/oscuro y revisión a 1366x768 y 390x844 sobre el equipo del proyecto. Las pruebas automatizadas no sustituyen esa validación visual.
