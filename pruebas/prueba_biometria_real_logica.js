/*
    Archivo: prueba_biometria_real_logica.js

    Propósito:
    Probar la lógica del modo real sin requerir hardware durante la suite automática.

    Comprueba que una plantilla entregada por un puente real falso se cifra en Node,
    nunca llega al frontend y luego se utiliza internamente para identificación 1:N.
*/
"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createProjectServer } = require("../servidor/servidor");

const CLAVE = "clave-local-real-prueba-2026";
const PLANTILLA = Buffer.from("fpprint-serializado-real-de-prueba").toString("base64");

function json(res, estado, datos) {
    res.writeHead(estado, { "Content-Type": "application/json" });
    res.end(JSON.stringify(datos));
}
async function cuerpo(req) { const b=[]; for await (const c of req) b.push(c); return JSON.parse(Buffer.concat(b).toString()||"{}"); }

async function crearPuente() {
    const capturas = new Map();
    const estado = { ultima: null };
    const server = http.createServer(async (req,res) => {
        if (req.headers.authorization !== `Bearer ${CLAVE}`) return json(res,401,{correcto:false,error:{codigo:"NO_AUTORIZADO"}});
        const u = new URL(req.url,"http://127.0.0.1");
        if (req.method==="GET" && u.pathname==="/v1/salud") return json(res,200,{correcto:true,servicio:"puente_biometrico",version_contrato:"1.0",modo:"real"});
        if (req.method==="GET" && u.pathname==="/v1/lector") return json(res,200,{correcto:true,modo:"real",lector:{disponible:true,simulado:false,hardware_detectado:true,modelo:"Digital Persona U.are.U 4500",estado:"listo",driver:"uru4000",identificacion_1_n:true}});
        if (req.method==="POST" && u.pathname==="/v1/capturas") {
            const b=await cuerpo(req); estado.ultima=b; const id=`real_${capturas.size+1}`;
            const resultado=b.operacion==="enrolamiento"
                ? {enrolamiento_completado:true,usuario_id:b.usuario_id,dedo:"indice_derecho",calidad:"aceptada",plantilla_biometrica:PLANTILLA}
                : b.operacion==="identificacion"
                    ? {coincidencia:true,usuario_id:b.plantillas[0].usuario_id,calidad:"aceptada"}
                    : {coincidencia:true,calidad:"aceptada"};
            const c={id,operacion:b.operacion,estado:"completada",modo:"real",usuario_id:b.usuario_id||"",creada_en:new Date().toISOString(),vence_en:new Date().toISOString(),finalizada_en:new Date().toISOString(),resultado,error:null};
            capturas.set(id,c); return json(res,202,{correcto:true,captura:c});
        }
        const m=u.pathname.match(/^\/v1\/capturas\/([\w-]+)$/);
        if (m && req.method==="GET") return json(res,200,{correcto:true,captura:capturas.get(m[1])});
        if (m && req.method==="DELETE") { const c=capturas.get(m[1]); c.estado="cancelada"; return json(res,200,{correcto:true,captura:c}); }
        json(res,404,{correcto:false,error:{codigo:"CAPTURA_NO_ENCONTRADA"}});
    });
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    return {server,estado,url:`http://127.0.0.1:${server.address().port}`};
}

async function login(base, id, password) {
    const r=await fetch(base+"/api/auth/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:id,password})});
    return r.headers.get("set-cookie").split(";")[0];
}
async function api(base,ruta,cookie,method="GET",body) {
    const r=await fetch(base+ruta,{method,headers:{Cookie:cookie,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
}

(async()=>{
    const bridge=await crearPuente();
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sena-bio-real-server-"));
    const server=createProjectServer({
        adminPassword:"admin-real", instructorPassword:"instructor-real",
        apprentices:[{id:"aprendiz-real",document:"1001",name:"Aprendiz Real",email:"real@gmail.com",role:"Aprendiz",status:"Activo",program:{ficha:"3349882",code:"3349882",name:"ADSO"},attendance:[]}],
        managedUsers:[{id:"aprendiz-real",document:"1001",name:"Aprendiz Real",email:"real@gmail.com",role:"Aprendiz",status:"Activo",ficha:"3349882"}],
        csvUsers:[{identificacion:"1001",tipo_documento:"CC",nombre:"Aprendiz Real",correo:"real@gmail.com",rol:"Aprendiz",estado:"Activo",ficha:"3349882"}],
        attendanceRecords:[],auditFile:null,emailSender:async()=>({id:"x"}),publicUrl:"",allowedEmails:"",allowedDomain:"",sqlData:{ambientes:[],horarios:[],programas:[],fichas:[]},
        biometriaHabilitada:true,biometriaModo:"real",biometriaUrlServicio:bridge.url,biometriaClaveServicio:CLAVE,
        biometriaClaveCifrado:crypto.randomBytes(32).toString("hex"),biometriaDirectorioReal:dir
    });
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    const base=`http://127.0.0.1:${server.address().port}`;
    try {
        const admin=await login(base,"admin","admin-real");
        const inst=await login(base,"instructor","instructor-real");
        const st=await api(base,"/api/biometria/estado",inst);
        assert.equal(st.data.modo,"real"); assert.equal(st.data.lector.hardware_detectado,true);
        const sinAutorizacion=await api(base,"/api/biometria/capturas",admin,"POST",{operacion:"enrolamiento",usuario_id:"aprendiz-real",tiempo_limite_segundos:5});
        assert.equal(sinAutorizacion.status,400,"No se puede enrolar sin confirmar autorización documentada.");
        assert.equal(sinAutorizacion.data.error.codigo,"AUTORIZACION_REQUERIDA");
        const e=await api(base,"/api/biometria/capturas",admin,"POST",{operacion:"enrolamiento",consentimiento_confirmado:true,usuario_id:"aprendiz-real",tiempo_limite_segundos:5});
        const [eg, eg2] = await Promise.all([
            api(base,`/api/biometria/capturas/${e.data.captura.id}`,admin),
            api(base,`/api/biometria/capturas/${e.data.captura.id}`,admin)
        ]);
        assert.equal(eg2.status, 200, "Consultas simultáneas al finalizar el enrolamiento deben compartir la persistencia");
        assert.equal(eg.data.captura.resultado.plantilla_biometrica,null);
        assert.doesNotMatch(JSON.stringify(eg.data),new RegExp(PLANTILLA.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
        const eu=await api(base,"/api/biometria/usuarios/aprendiz-real/estado",admin);
        assert.equal(eu.data.enrolado,true); assert.equal(eu.data.modo,"real");
        const id=await api(base,"/api/biometria/capturas",inst,"POST",{operacion:"identificacion",ficha:"3349882",jornada:"Mañana",tiempo_limite_segundos:5});
        assert.equal(id.status,202);
        assert.equal(bridge.estado.ultima.operacion,"identificacion");
        assert.equal(bridge.estado.ultima.plantillas.length,1);
        assert.equal(bridge.estado.ultima.plantillas[0].plantilla_biometrica,PLANTILLA);
        const ig=await api(base,`/api/biometria/capturas/${id.data.captura.id}`,inst);
        assert.equal(ig.data.captura.resultado.usuario.id,"aprendiz-real");
        assert.equal(typeof ig.data.captura.resultado.ticket_asistencia,"string");
        assert.doesNotMatch(JSON.stringify(ig.data),new RegExp(PLANTILLA.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
        const confirmar=await api(base,"/api/biometria/asistencia/confirmar",inst,"POST",{ticket_asistencia:ig.data.captura.resultado.ticket_asistencia});
        assert.equal(confirmar.status,201);
        assert.equal(confirmar.data.registro.estado,"presente");
        assert.equal(confirmar.data.registro.metodo,"huella");
        const repetir=await api(base,"/api/biometria/asistencia/confirmar",inst,"POST",{ticket_asistencia:ig.data.captura.resultado.ticket_asistencia});
        assert.equal(repetir.status,410);
        console.log("OK: modo real cifra enrolamiento, identifica por ficha y registra asistencia con ticket de un solo uso.");
    } finally {
        await new Promise(r=>server.close(r)); await new Promise(r=>bridge.server.close(r)); fs.rmSync(dir,{recursive:true,force:true});
    }
})().catch(e=>{console.error(e);process.exitCode=1;});
