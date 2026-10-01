// Distribución esperada: no crea cuentas ni modifica matrículas existentes.
const DAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
const SCALE = Object.freeze({ apprentices: 240, fichas: 8, apprenticesPerFicha: 30, instructors: 11, minimumUsers: 300 });

function fichaPlan(code) {
    const number = Number(code);
    if (!Number.isInteger(number) || number < 3349882 || number > 3349889) return null;
    const morning = number <= 3349885;
    return { expectedApprentices: 30, days: [...DAYS], schedule: morning ? 'Mañana' : 'Tarde', start: morning ? '07:00' : '13:00', end: morning ? '13:00' : '19:00' };
}

function weeklyPlan(fichas) {
    return fichas.flatMap(ficha => {
        const plan = fichaPlan(ficha.numero);
        if (!plan) return [];
        const { days, ...shift } = plan;
        return days.map(day => ({ fichaId: String(ficha.id), ficha: String(ficha.numero), day, ...shift }));
    });
}

module.exports = { DAYS, SCALE, fichaPlan, weeklyPlan };
