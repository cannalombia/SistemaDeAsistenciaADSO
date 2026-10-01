const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createProjectServer } = require("../servidor/servidor");
const { serializeCsvUsers } = require("../servidor/modulos/persistencia");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-visual-"));
const usersCsvFile = path.join(directory, "usuarios.csv");
fs.writeFileSync(usersCsvFile, serializeCsvUsers([
    { identificacion: "900000001", tipo_documento: "Cédula de Ciudadanía", nombre: "Instructor Visual", correo: "instructor.visual@example.com", rol: "instructor", estado: "activo", ficha: "4455667", password: "instructor123" },
    { identificacion: "100000001", tipo_documento: "Tarjeta de Identidad", nombre: "Aprendiz Visual", correo: "aprendiz.visual@example.com", rol: "aprendiz", estado: "activo", ficha: "4455667" }
]));

const server = createProjectServer({
    usersCsvFile,
    trainingFile: path.join(directory, "formacion.json"),
    auditFile: path.join(directory, "auditoria.json"),
    adminCredentialsFile: path.join(directory, "admin.json"),
    reportsFile: path.join(directory, "reportes.json"),
    adminPassword: "visual-test",
    exposeTestCode: true,
    emailSender: async () => ({ id: "visual-test" }),
    publicUrl: "",
    allowedDomain: "",
    allowedEmails: "",
    csvUsers: [
        { identificacion: "900000001", tipo_documento: "Cédula de Ciudadanía", nombre: "Instructor Visual", correo: "instructor.visual@example.com", rol: "Instructor", estado: "Activo", ficha: "4455667" },
        { identificacion: "100000001", tipo_documento: "Tarjeta de Identidad", nombre: "Aprendiz Visual", correo: "aprendiz.visual@example.com", rol: "Aprendiz", estado: "Activo", ficha: "4455667" }
    ],
    apprentices: [{ id: "aprendiz-visual", document: "100000001", name: "Aprendiz Visual", email: "aprendiz.visual@example.com", role: "Aprendiz", status: "Activo", phone: "", address: "", program: { code: "4455667", name: "Análisis y desarrollo", level: "Tecnólogo", ficha: "4455667", schedule: "Mañana", mode: "Presencial", status: "En formación" }, attendance: [] }],
    managedUsers: [{ id: "aprendiz-visual", document: "100000001", documentType: "Tarjeta de Identidad", username: "aprendiz.visual", name: "Aprendiz Visual", email: "aprendiz.visual@example.com", role: "Aprendiz", status: "Activo", ficha: "4455667", salt: "visual-learner-salt", passwordHash: crypto.scryptSync("learner123", "visual-learner-salt", 64).toString("hex") }],
    attendanceRecords: [],
    programs: [{ id: 1, nombre: "Análisis y desarrollo", nivel: "Tecnólogo", duracion: "24 meses", estado: "Activo" }],
    trainingState: {
        fichas: [{ id: 1, numero: "4455667", programaId: 1, jornada: "Mañana", modalidad: "Presencial", estado: "Activa", instructorId: "900000001" }],
        ambientes: [{ id: 1, codigo: "A101", nombre: "Ambiente principal", capacidad: 30, tipo: "Aula", estado: "Disponible", zona: "Zona 1" }],
        horarios: [{ id: 1, fichaId: 1, ambienteId: 1, instructorId: "900000001", dia: "Lunes", horaInicio: "06:00", horaFin: "10:00", estado: "Activo" }],
        attendanceClosures: []
    },
    reports: [], reportsFile: null, auditRecords: [], auditFile: null, excuses: [], excusesFile: null
});

const visualPort = Number(process.env.VISUAL_PORT || 3100);
server.listen(visualPort, "127.0.0.1", () => console.log(`Servidor visual listo en http://localhost:${visualPort}/login.html`));
