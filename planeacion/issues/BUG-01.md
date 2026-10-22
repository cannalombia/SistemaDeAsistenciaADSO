# BUG-01 · API lista pero enrolamiento no disponible

## Descripcion
La API informaba lector listo, pero la pantalla de enrolamiento lo mostraba no disponible.

## Reproduccion
1. Adjuntar `05ba:000a` a Ubuntu 24.04 mediante usbipd.
2. Iniciar puente en `:4318` y Node en `:3000`.
3. Consultar estado y abrir el registro de huella.

## Esperado
Si el lector esta disponible para captura, API e interfaz coinciden; si otro servicio lo retiene, ambas informan indisponibilidad accionable.

## Actual
Antes de la mitigacion, el estado general era positivo y el enrolamiento no podia usar el dispositivo.

## Diagnostico y mitigacion
Se controlo `fprintd` y se aplicaron propietario `root:plugdev` y permisos `660`. Despues, `fprintd verify` encontro coincidencia y el registro mostro “Identidad verificada”.

## Pendiente
Reiniciar WSL2 y repetir. No se afirma que la correccion sea persistente ni se cierra el bug hasta demostrarlo.
