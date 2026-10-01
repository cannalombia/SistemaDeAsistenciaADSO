// Datos locales de respaldo para maquetación. La información operativa llega desde la API.
(function () {
    "use strict";

    const datos = {
        fichas: [
            { code: "3349882", program: "ADSO", schedule: "Mañana", mode: "Presencial", status: "Activa" },
            { code: "3349883", program: "ADSO", schedule: "Mañana", mode: "Presencial", status: "Activa" },
            { code: "3349884", program: "ADSO", schedule: "Tarde", mode: "Presencial", status: "Activa" },
            { code: "3349885", program: "ADSO", schedule: "Noche", mode: "Presencial", status: "Activa" }
        ],
        schedules: [
            { ficha: "3349881", student: "Felipe Mendoza", zone: "Zona 6", day: "Martes", instructor: "Yuly Saenz", time: "6:00 - 14:00" },
            { ficha: "3349881", student: "Juliana Castaño", zone: "Zona 6", day: "Miércoles", instructor: "Luis Fernando Amarillo", time: "6:00 - 14:00" },
            { ficha: "3349882", student: "Juan Pérez", zone: "Zona 1", day: "Lunes", instructor: "Jorge Raigosa", time: "6:00 - 14:00" },
            { ficha: "3349882", student: "María Rodríguez", zone: "Zona 1", day: "Martes", instructor: "Yuly Saenz", time: "6:00 - 14:00" },
            { ficha: "3349884", student: "Luis Martínez", zone: "Zona 2", day: "Viernes", instructor: "Jhoan Sebastián Duque", time: "6:00 - 14:00" }
        ],
        environments: [
            { code: "101", name: "Ambiente 1", capacity: 30, type: "Aula", status: "Disponible", zone: "1" },
            { code: "202", name: "Ambiente 2", capacity: 30, type: "Aula", status: "Disponible", zone: "2" },
            { code: "303", name: "Ambiente 3", capacity: 25, type: "Laboratorio", status: "Disponible", zone: "3" },
            { code: "404", name: "Ambiente 4", capacity: 32, type: "Aula", status: "Ocupado", zone: "4" }
        ],
        students: [
            { id: "muestra-1", name: "Aprendiz de muestra 1", ficha: "3349882", status: "presente" },
            { id: "muestra-2", name: "Aprendiz de muestra 2", ficha: "3349882", status: "tarde" },
            { id: "muestra-3", name: "Aprendiz de muestra 3", ficha: "3349884", status: "ausente" }
        ]
    };

    window.SenaDatosDemostracion = Object.freeze(datos);
})();
