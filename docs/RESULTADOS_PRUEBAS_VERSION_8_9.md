# Validación de la versión 8.9

**Fecha:** 19/10/2026
**Entorno de pruebas:** Linux aislado, Node.js 22.16, Python 3.13.5, Chromium sin acceso al lector USB.

| Prueba | Resultado | Alcance real |
|---|---|---|
| `npm test` (suite completa del proyecto) | APROBADA | Validaciones estructurales, módulos, backend y escenarios de integración con dobles de prueba; sin lector físico |
| `python3 pruebas/prueba_puente_biometrico_89.py` | 3/3 aprobadas | HTTP local autenticado, rangos de timeout y cancelación sin liberar prematuramente el lector |
| `node --check` de cuatro módulos JS editados | APROBADA | Sintaxis de Node y frontend |
| `python3 -m py_compile puente_biometrico_real/servidor_real.py` | APROBADA | Sintaxis del puente |
| Revisión de interfaz en Chromium (1512 px / 390 px) | REVISADA | Maquetación estática con datos de ejemplo, sin scroll horizontal; no equivale a captura real |
| DigitalPersona 4500 en WSL2 y libfprint | **PENDIENTE** | No existe acceso al lector USB del usuario desde este entorno |
| Enrolar, verificar e identificar un dedo real; grabar asistencia en MySQL real | **PENDIENTE** | Requiere ejecución en PC Windows con USB, WSL y datos de prueba autorizados |
| Scripts PowerShell y compilación C con libfprint | **PENDIENTE** | No se dispone de PowerShell ni del SDK/desarrollo libfprint de WSL en el entorno aislado |

**Criterio de entrega:** el paquete se ofrece como candidato 8.9 validado a nivel de código y pruebas automáticas, no como certificación de que una captura física se haya realizado. Mantener respaldo de la 8.5 hasta completar los ensayos en el equipo Windows.

## Seguridad de la entrega

El ZIP de entrega elimina `.env`, `.env.bak`, llaves privadas, plantillas `.bio.json`, credenciales de administrador, datos de operación, logs, capturas de evidencias, caches Python y `node_modules`. Las pruebas usan valores de prueba ficticios, nunca plantillas reales.
