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

## Pruebas y limites

- `npm test`: aprobado el 21/10/2026 fuera del sandbox; la primera ejecucion quedo bloqueada por `EPERM` al renombrar un temporal y la repeticion completa termino con codigo 0.
- `node verificar-plan.js`: aprobado `34/34`, incluida la comprobacion remota de GitHub.
- Plantillas y datos reservados: revisados antes de stage y push.
- Hardware observado el 21/10: `05ba:000a` Attached, `lsusb`, `fprintd verify`, puente `:4318`, Node `:3000` y estado real disponible.
- Pendiente: persistencia del permiso despues de reiniciar WSL2 y asistencia fisica completa almacenada una sola vez en MySQL.

## Tablero y automatizaciones

- Proyecto publico y vinculado: https://github.com/users/cannalombia/projects/1
- Vista `Board`: creada y verificada por GraphQL con layout `BOARD_LAYOUT`.
- `Item added to project`: activo.
- `Item closed`: activo; movio automaticamente a `Done` los issues cerrados por `a789cd9`.
- `Auto-add to project`: pendiente de activacion manual. La API GraphQL expuesta permite consultar y borrar workflows, pero no ofrece una mutacion para crear/configurar este flujo.

Para completar el unico ajuste manual: abrir el tablero → `...` → `Workflows` → `Auto-add to project` → repositorio `cannalombia/SistemaDeAsistenciaADSO` → filtro `is:issue` → `Save and turn on workflow`.
