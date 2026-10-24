# Entrega · Git y GitHub II · BioSecure SENA 9.1

- **Responsable GitHub:** `cannalombia`
- **Repositorio:** https://github.com/cannalombia/SistemaDeAsistenciaADSO
- **Tablero:** https://github.com/users/cannalombia/projects/1
- **Rama principal:** `main`

## Trazabilidad

| Trabajo | Issue | Estado | Commit o PR |
|---|---:|---|---|
| HU-01 Estado confiable del lector | [#2](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/2) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| HU-02 Enrolamiento autorizado | [#3](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/3) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| HU-03 Asistencia biometrica | [#4](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/4) | Abierto / Todo: falta E2E fisico MySQL | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) referencia sin cerrar |
| HU-04 Resumen privado | [#5](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/5) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| HU-05 Diagnostico y arranque | [#6](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/6) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| HU-06 Proteccion de datos | [#7](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/7) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| BUG-01 Permisos/fprintd | [#8](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/8) | Abierto: falta reinicio WSL | Sin cierre |
| BUG-02 servidor visual ausente | [#9](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/9) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| BUG-03 sidebar blanca | [#10](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/10) | Cerrado / Done | [`a789cd9`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/a789cd9) |
| DOC-01 Historial verificable 16–23 de octubre | [#11](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/11) | Cerrado / Done | [`e68d297`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/e68d2974ba856d8c31951078424ac41c12b2acb0) y [`b0c6986`](https://github.com/cannalombia/SistemaDeAsistenciaADSO/commit/b0c698663c30196f1ae0e3d4ce01eeb0a03dbe38) (`closes #11`) |
| BUG-04 resumen de huellas blanco en modo oscuro | [#12](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/12) | Abierto / Todo; validado localmente | Cambio local sin commit |
| BUG-05 telemetria biometrica blanca en modo oscuro | [#13](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/13) | Abierto / Todo; validado localmente | Cambio local sin commit |

## Pruebas y limites

- `npm test`: aprobado el 21/10/2026 fuera del sandbox; la primera ejecucion quedo bloqueada por `EPERM` al renombrar un temporal y la repeticion completa termino con codigo 0.
- `node verificar-plan.js`: aprobado `34/34`, incluida la comprobacion remota de GitHub.
- Plantillas y datos reservados: revisados antes de stage y push.
- Hardware observado el 21/10: `05ba:000a` Attached, `lsusb`, `fprintd verify`, puente `:4318`, Node `:3000` y estado real disponible.
- Pendiente: persistencia del permiso despues de reiniciar WSL2 y asistencia fisica completa almacenada una sola vez en MySQL.
- BUG-04: paridad oscura del resumen biometrico validada con pruebas de tema/sistema visual, prueba funcional del resumen y render headless de Edge. Se registro como #12 y permanece en Todo hasta publicar su cambio de codigo por separado.
- Validacion BUG-04 (23/10/2026): `prueba_tema_usuarios_estadisticas.js`, `prueba_sistema_visual.js` y `prueba_resumen_biometrico_91.js` terminaron con codigo 0; `git diff --check` no reporto errores.
- Verificacion intermedia de planeacion: 37/38 antes de autenticar GitHub y publicar #12/#13.
- `node verificar-plan.js` (23/10/2026): aprobado `41/41` despues de sincronizar #11, #12, #13, responsables, etiquetas y tablero.
- Validacion BUG-05 (23/10/2026): `prueba_biometria_pro.js`, `prueba_biometria_frontend.js` y `prueba_sistema_visual.js` terminaron con codigo 0; render oscuro de Edge revisado sin superficies blancas.
- `npm test` (23/10/2026): suite completa terminada con codigo 0 fuera del sandbox. Los mensajes de QR invalido, `FALLO_*_SIMULADO` y HTTP de error pertenecen a escenarios negativos que finalizaron en `OK`.
- Pruebas focalizadas (23/10/2026): tema oscuro, sistema visual, resumen 9.1, biometria PRO y frontend biometrico terminaron con codigo 0. El primer intento del resumen fue bloqueado por `EACCES` del sandbox al abrir un puerto local; la repeticion fuera de esa restriccion aprobo.
- Sincronizacion segura (23/10/2026): se genero un parche recuperable de los 12 archivos modificados, se comprobo con `git apply --reverse --check` y `main` avanzo por fast-forward de `df9dcb1` a `1bde09e`. No se uso `reset`, no se reescribio historial y los cambios locales permanecieron intactos.
- Historial 16–23: no existen commits publicados del 16 al 20. La bitacora distingue esas fechas documentales de los commits autenticos del 21 y 22.

## Tablero y automatizaciones

- Proyecto publico y vinculado: https://github.com/users/cannalombia/projects/1
- Vista `Board`: creada y verificada por GraphQL con layout `BOARD_LAYOUT`.
- `Item added to project`: activo.
- `Item closed`: activo; movio automaticamente a `Done` los issues cerrados por `a789cd9`.
- `Auto-add to project`: pendiente de activacion manual. La API GraphQL expuesta permite consultar y borrar workflows, pero no ofrece una mutacion para crear/configurar este flujo.

Para completar el unico ajuste manual: abrir el tablero → `...` → `Workflows` → `Auto-add to project` → repositorio `cannalombia/SistemaDeAsistenciaADSO` → filtro `is:issue` → `Save and turn on workflow`.

## Seguimiento publicado el 23/10/2026

- Historias: [#2](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/2#issuecomment-6373487044), [#3](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/3#issuecomment-6373487582), [#4](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/4#issuecomment-6373488409), [#5](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/5#issuecomment-6373489017), [#6](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/6#issuecomment-6373489459) y [#7](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/7#issuecomment-6373490012).
- Incidencias: [#8](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/8#issuecomment-6373490416), [#9](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/9#issuecomment-6373491049), [#10](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/10#issuecomment-6373491687), [#12](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/12#issuecomment-6373493588) y [#13](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/13#issuecomment-6373494185).
- Cierre documental: [#11](https://github.com/cannalombia/SistemaDeAsistenciaADSO/issues/11#issuecomment-6373492462).
