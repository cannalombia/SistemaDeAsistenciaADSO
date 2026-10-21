# BUG-02 · servidor_visual.js ausente en una extraccion

## Descripcion
`ABRIR_DEMO_LOCAL.cmd` no arrancaba porque faltaba `pruebas/servidor_visual.js`.

## Reproduccion
1. Usar la extraccion afectada.
2. Ejecutar `ABRIR_DEMO_LOCAL.cmd`.
3. Observar el mensaje de archivo faltante.

## Esperado
La demostracion local inicia en un puerto dedicado y sirve las paginas con datos ficticios.

## Actual
El script terminaba antes de iniciar Node.

## Validacion preparada
9.1 incluye el archivo, valida puerto ocupado y la auditoria registro 13 paginas y 119 recursos HTTP correctos. No prueba MySQL ni biometria fisica.
