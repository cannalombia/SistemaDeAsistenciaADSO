# Flujo de trabajo para mejorar el proyecto

Este es el orden de trabajo que se seguirá en cada mejora. La idea es que una
pantalla bonita no tape problemas de datos, seguridad o mantenimiento.

## 1. Entender el cambio

- Escribir qué necesita la persona y qué queda fuera.
- Identificar las páginas, rutas, datos y roles afectados.
- Guardar una captura o un ejemplo cuando el cambio sea visual.

La tarea no empieza a programarse hasta que se pueda explicar en dos o tres
frases sencillas.

## 2. Revisar el código existente

- Buscar una función o componente que ya resuelva algo parecido.
- Revisar nombres, dependencias y pruebas relacionadas.
- Confirmar si el cambio toca información privada o envío de correos.

Si aparece código duplicado, primero se decide cuál será la única fuente y
después se modifica la interfaz.

## 3. Hacer un cambio pequeño

- Separar reglas del negocio, acceso a datos e interfaz.
- Usar nombres que describan la intención, no nombres genéricos como `data2`,
  `tempFinal` o `handleThing`.
- Evitar comentarios que repitan literalmente lo que hace la siguiente línea.
- No inventar datos de producción. Las muestras deben estar etiquetadas.

Cada paso debe dejar el sistema en un estado que todavía se pueda probar.

## 4. Comprobarlo

- Ejecutar `npm.cmd run test:unit` para reglas y utilidades.
- Ejecutar `npm.cmd run test:integration` para páginas, permisos y API.
- Probar manualmente el recorrido modificado desde el navegador.
- Revisar consola, respuesta de red y mensajes visibles.

Un cambio no se da por terminado solo porque “se ve bien”. También debe fallar
de forma entendible cuando el dato sea incorrecto o el servicio externo no esté
disponible.

## 5. Revisar como mantenedor

Antes de cerrar la tarea se responde:

- ¿El nombre del archivo permite adivinar qué contiene?
- ¿Quedó la misma regla copiada en más de un lugar?
- ¿Hay una contraseña, correo privado o código temporal dentro del repositorio?
- ¿La función es demasiado larga para entenderla sin desplazarse varias veces?
- ¿La prueba verifica comportamiento o solo busca una palabra?
- ¿La documentación sigue diciendo la verdad después del cambio?

## 6. Dejar rastro

- Actualizar la prueba que protege el comportamiento.
- Anotar una decisión cuando haya una alternativa razonable.
- Usar un mensaje de Git que cuente el cambio, por ejemplo:
  `refactor: separar el servicio de correo`.

No se fabrican fechas, autores ni una secuencia falsa de commits. El historial
debe mostrar el trabajo real a partir de este punto.

## Criterio de salida

Una tarea está lista cuando pasa las pruebas, funciona en el recorrido manual,
no expone información privada, tiene nombres comprensibles y deja explícito
cualquier límite que no se haya resuelto.
