# BioSecure SENA 8.9.1 — Entrega técnica y pruebas

## Alcance
Actualización **incremental** sobre 8.9: no se reemplazó la arquitectura USB/WSL2/libfprint/C/Python/Node, no se modificaron los módulos QR, fichas, horarios, estadísticas ni la estructura general de MySQL.

## Cambios comprobables
1. **Puente Python:** el ejecutor del motor ahora drena `stdout` y `stderr` en paralelo; controla límite de respuesta (4 MiB), límite de diagnóstico (128 KiB), plazo de ejecución, grupo de procesos y cierre de tuberías. No transmite texto arbitrario de `stderr` al frontend ni incorpora plantillas a mensajes de error.
2. **Almacén de plantillas:** escritura en archivo temporal exclusivo, sincronización a disco y reemplazo por `rename`; si el antivirus o Windows bloquea el reemplazo, informa el fallo conservando la plantilla anterior. Se eliminó la copia no atómica sobre el destino existente.
3. **Consultas concurrentes:** el resultado de un enrolamiento terminado comparte la operación de guardado; se evita volver a cifrar y auditar por una consulta GET simultánea.
4. **Interfaz de enrolamiento:** consola BioSecure, telemetría de flujo (no lectura de intensidad física), cronología de eventos, instrucciones, controles, confirmación de autorización y estados vinculados al servidor. Los textos variables se insertan mediante `textContent`, sin HTML arbitrario.
5. **Asistencia:** consulta serializada del resultado y confirmación única por flujo de frontend del ticket de asistencia. Mejoras de estado, cronología y respuesta visual. El backend conserva su ticket de un solo uso.
6. **Accesibilidad:** apariencia responsive y soporte para `prefers-reduced-motion`.

## Pruebas ejecutadas en ambiente de desarrollo
- `npm test`: suite principal completa aprobada con una instalación de dependencias local preexistente, no con una instalación nueva desde Internet.
- `python3 pruebas/prueba_puente_biometrico_89.py`: 3 pruebas de autenticación, validación y cancelación, aprobadas.
- `python3 pruebas/prueba_puente_biometrico_891.py`: 5 pruebas con motor **falso únicamente dentro de la prueba** (cientos de KB y 2 MiB en tuberías, exceso de salida, timeout, y eventos de progreso), aprobadas.
- Regresión del almacén: al simular `EPERM` en `rename`, la plantilla anterior sigue descifrable y no quedan temporales.
- Regresión de enrolamiento: dos GET simultáneos sobre una captura terminada devuelven éxito y plantilla privada no es enviada al cliente.
- Revisión estática de diseño escritorio y móvil: sin desbordamiento horizontal. Los recursos externos de iconografía pueden depender de conexión a Internet.

## Límites de la validación
**No se ha probado con el sensor físico DigitalPersona en este contenedor.** Una huella registrada en 8.5 es evidencia de funcionamiento anterior, **no** prueba automática de que 8.9.1 identifique y registre asistencia en una instalación nueva. No se validó una migración real de plantillas privadas ni una instalación `npm ci` sin conexión.

## Instalación segura sin perder la huella registrada en 8.5
1. **No elimines la versión 8.5.** Conserva un respaldo privado de su carpeta `datos/biometria_real/plantillas`, de `.env` y de los datos del proyecto. Nunca compartas estos archivos por chat ni los subas a Git.
2. Extrae el ZIP 8.9.1 en una carpeta distinta.
3. Ejecuta `npm ci` con acceso a Internet desde PowerShell en la carpeta nueva.
4. Copia **localmente** los ajustes y claves de tu `.env` original al `.env` de la nueva carpeta. La clave `BIOMETRIC_ENCRYPTION_KEY` debe ser **exactamente la misma** para descifrar las plantillas originales. No la publiques. Comprueba además la conexión al mismo MySQL y que los identificadores de aprendices sean consistentes.
5. Copia **localmente y con respaldo previo** las plantillas `.bio.json` de 8.5 al mismo directorio `datos/biometria_real/plantillas` de la nueva carpeta. No cambies nombres ni contenido. Mantén permisos privados del sistema de archivos. No se incluyen plantillas ni claves reales en este ZIP.
6. Abre Ubuntu WSL2 y adjunta el USB `05ba:000a` desde **PowerShell de administrador** mediante `usbipd attach --wsl --busid <BUSID actual>`; comprueba con `wsl -d Ubuntu-24.04 -- lsusb`.
7. Inicia el puente Python y Node con los procedimientos existentes. Asegura que `http://127.0.0.1:4318/v1/salud` responde `401` **sin clave** y `200` **con la clave** (no muestres ni imprimas secretos).
8. Ingresa como administrador y consulta el estado del aprendiz cuya huella ya se registró. **No vuelvas a enrolarlo** hasta confirmar que la plantilla original se recupera correctamente. Si el sistema informa que no está registrado, revisa primero ruta, asociación de ID y clave de cifrado.
9. Prueba con la misma persona y el mismo dedo: verificación 1:1, identificación desde Asistencia en su ficha y una sola escritura de asistencia en MySQL. Comprueba también errores de cancelación, desconexión USB y asistencia ya registrada.
10. No habilites el túnel público durante pruebas biométricas. Obtén la autorización documentada del voluntario; conserva un procedimiento de asistencia alternativo.

## Criterio para dar por cerrada una versión 9.0
Captura física de prueba autorizada → descifrado tras reinicio → identificación 1:N en ficha correcta → asistencia guardada exactamente una vez en MySQL → repetición y recuperación tras reconexión USB. Hasta entonces, 8.9.1 sigue siendo una **versión candidata validada por software**.
