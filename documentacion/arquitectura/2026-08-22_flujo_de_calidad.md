# Forma de trabajo para los próximos cambios

La intención de esta guía es sencilla: poder corregir una pantalla sin romper
otra. No hace falta llenar documentos largos; basta con dejar claro qué se va a
tocar y cómo se comprobó.

## Antes de programar

- Explicar el problema en dos o tres frases.
- Revisar la pantalla, la ruta y el archivo donde se guardan sus datos.
- Confirmar si hay información privada o envío de correos involucrado.

## Mientras se hace el cambio

- Aprovechar una función existente antes de copiarla.
- Usar nombres que indiquen para qué sirve cada dato.
- Comentar decisiones o excepciones, no instrucciones obvias de JavaScript.
- Mantener los datos de demostración separados de los registros reales.
- Probar un cambio pequeño antes de continuar con el siguiente.

## Antes de terminar

1. Ejecutar `npm.cmd run test:unit`.
2. Ejecutar `npm.cmd run test:integration`.
3. Recorrer manualmente la pantalla modificada.
4. Revisar que no queden claves, correos privados ni archivos temporales.
5. Actualizar la documentación que haya dejado de ser cierta.

Las pruebas deben comprobar resultados: que un usuario se cree, se modifique o
se elimine. Buscar solamente el nombre de un comando dentro de un archivo no
demuestra que la función esté trabajando.

## Historial

Cada cambio nuevo se guarda con una descripción corta y real. No se inventan
fechas, autores ni modificaciones anteriores. Si queda una limitación, se anota
en lugar de presentarla como resuelta.
