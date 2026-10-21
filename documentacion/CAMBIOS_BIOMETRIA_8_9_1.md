# Cambios BioSecure 8.9.1

## Enfoque
Esta revisión se construyó sobre la versión 8.9 para reforzar la experiencia biométrica sin alterar los módulos funcionales ya aprobados.

## Mejoras aplicadas

### 1. Consola de enrolamiento premium
- Se añadió una capa de telemetría visual en vivo.
- Se incorporó una bitácora de eventos de la sesión.
- Se añadieron barras de intensidad para representar el estado de lectura.
- Se mejoró la sensación de continuidad entre selección, captura, procesamiento, éxito, error y revocación.

### 2. Asistencia por huella más profesional
- Se añadió una telemetría visual dentro del panel de asistencia.
- Se incorporó una línea de tiempo con eventos del flujo biométrico.
- Se reforzó la lectura del estado del lector, del canal local y del resultado final.
- Se ajustaron los mensajes para que el usuario entienda mejor cada fase.

### 3. Estilo y movimiento
- Se añadieron animaciones de brillo y pulsación sobre el lector y la huella.
- Se mejoró la profundidad visual de tarjetas, chips y paneles.
- Se respetó `prefers-reduced-motion` para accesibilidad.

## Archivos principales ajustados
- `aplicacion/paginas HTML/huella_registro.html`
- `aplicacion/recursos/JS scripts/huella_registro.js`
- `aplicacion/paginas HTML/asistencia.html`
- `aplicacion/recursos/JS scripts/biometria_asistencia.js`
- `aplicacion/recursos/estilos CCS/biometria_89.css`
- `BUILD_ID.txt`

## Criterio de seguridad conservado
- El navegador no conoce secretos del puente biométrico.
- La biometría sigue consultándose a través del servidor principal.
- La plantilla biométrica sigue tratándose como dato cifrado del lado del servidor.

## Correcciones funcionales y verificaciones posteriores

- Puente Python: lectura simultánea y acotada de tuberías, terminación segura en timeout y sin exponer plantillas en errores.
- Almacén AES-256-GCM: conserva la plantilla anterior si falla el renombrado al reemplazar.
- Node: exclusión de consultas GET concurrentes que intenten guardar el mismo enrolamiento.
- Frontend: eliminación de HTML dinámico inyectable y consultas serializadas para confirmar asistencia una vez.
- Se añadieron pruebas de regresión Python y Node, y guía de migración segura.
- **No es una certificación de captura física:** requiere pruebas sobre el lector y MySQL del usuario.
