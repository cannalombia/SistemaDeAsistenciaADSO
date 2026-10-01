# Escala de formación BLUE MAGIC V5

La configuración esperada es de 240 aprendices, ocho fichas de 30 aprendices y
11 instructores. El sistema admite al menos 300 usuarios registrados; la prueba
automatizada importa 300 usuarios y consulta formación y directorio. Esto no es
una certificación de 300 sesiones simultáneas.

| Fichas | Jornada | Lunes a viernes |
| --- | --- | --- |
| 3349882, 3349883, 3349884, 3349885 | Mañana | 07:00–13:00 |
| 3349886, 3349887, 3349888, 3349889 | Tarde | 13:00–19:00 |

`servidor/configuracion/escala_formacion.js` define la distribución esperada.
La API `/api/training` entrega `scale`, `weeklyPlan` (40 franjas semanales) y
`plan` por ficha. Las franjas son disponibilidad de formación: no equivalen a
40 clases con personal y ambientes ya asignados. Las clases se siguen creando
y editando en el módulo Horario existente. Sus horas deben quedar dentro de la
jornada y sus días deben ser de lunes a viernes para estas ocho fichas.

El instructor de referencia de una ficha es opcional. Cada clase puede llevar
un instructor distinto y un mismo instructor puede trabajar con diferentes
fichas durante la semana. Se impiden cruces de ambiente, ficha o instructor:
un instructor no puede tener dos fichas asignadas en horarios superpuestos. Dos
clases consecutivas con la misma persona son válidas. Las funciones de otras
fichas, incluidas sus jornadas históricas, se conservan.

Los 30 aprendices son una distribución esperada, no un borrado o un límite que
expulse matrículas existentes. La tabla de fichas muestra la cantidad actual
frente a la esperada. No se crearon usuarios ficticios ni se reasignaron personas.
La cuenta de instructor integrada en el sistema se conserva además de las
cuentas registradas; no es una nueva contratación ni una persona inventada.

## Conservación y aplicación

Antes de editar se creó `respaldos/escala-v5-20260930-104925`, que contiene los
datos, CSV, fuentes, pruebas y configuración anteriores. Los ocho registros de
ficha conservan sus identificadores y referencias. Las seis clases existentes
conservan sus identificadores, días, instructores y ambientes. Se ajustaron sus
extremos fuera de jornada: 06:00 pasa a 07:00 y 14:00 pasa a 13:00. Las horas
interiores existentes se conservaron. El ambiente de 25 plazas conserva su
capacidad real; deberá elegirse uno con 30 plazas para clases de ficha completa.

Reiniciar el proceso Node activo para cargar las fuentes y `datos/formacion.json`
actualizados. No restaurar una instantánea anterior sin revisar su configuración.
La importación SQL admite ahora 1 MiB tanto en servidor como en formulario.

Validación: `npm test`, incluida `pruebas/prueba_escala.js`. Los usuarios de prueba
se crean exclusivamente en un directorio temporal que se elimina al terminar.

No se fija un instructor permanente por ficha ni se limita la cantidad de
fichas diferentes que puede atender durante la semana. La restricción operativa
es la ausencia de superposición horaria.
