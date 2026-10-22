# Reglas permanentes de trabajo

Estas reglas aplican a cualquier persona o agente que modifique BioSecure SENA.

1. Antes de cambiar codigo, crear o identificar un issue pequeno y comprobable.
2. Las historias deben usar `Como / quiero / para`, cumplir INVEST y contener al menos tres criterios `Dado / cuando / entonces`.
3. Mover solo el issue activo a `In Progress`; no declarar `Done` sin prueba.
4. Crear ramas o PR cuando la proteccion de `main` lo exija. No eludir revisiones.
5. Ejecutar las pruebas proporcionales al cambio y registrar el resultado real, incluidos fallos y limites del entorno.
6. Cerrar mediante `closes #N` para historias y `fixes #N` para bugs cuando el cambio llegue a la rama principal.
7. No versionar `.env`, claves, plantillas `*.bio.json`, datos personales, CSV operativos, bases, respaldos ni evidencia biometrica.
8. No afirmar que la biometria fisica funciona de extremo a extremo sin probar lector, enrolamiento, identificacion y persistencia MySQL con autorizacion.
9. Mantener sincronizados `planeacion/backlog.md`, el issue, el tablero y `ENTREGA.md`.
10. No retrofechar commits ni fabricar evidencia historica. Las fechas de bitacora describen trabajo; Git conserva sus fechas reales.
