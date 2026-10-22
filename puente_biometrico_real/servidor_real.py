#!/usr/bin/env python3
"""
Archivo: servidor_real.py

Propósito:
Exponer en 127.0.0.1 el mismo contrato HTTP del puente mock, pero usando el
DigitalPersona real mediante libfprint.

Responsabilidad:
- Autenticar al servidor Node con una clave compartida.
- Gestionar una captura activa por lector.
- Ejecutar enrolamiento, verificación e identificación en segundo plano.
- Mantener plantillas únicamente en archivos temporales durante una operación.

Límites:
No registra asistencia, no administra usuarios del sistema web, no persiste
plantillas y no expone imágenes de huella.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread, Event
import signal
from urllib.parse import urlparse
import hmac
import calendar
import json
import os
import secrets
import subprocess
import tempfile
import time

HOST = "127.0.0.1"
PORT = int(os.environ.get("PUERTO_PUENTE_BIOMETRICO", "4318"))
CLAVE = os.environ.get("CLAVE_LOCAL_PUENTE", "")
RUTA_CLAVE = os.environ.get("CLAVE_LOCAL_PUENTE_FILE", "")
if not CLAVE and RUTA_CLAVE:
    try:
        CLAVE = Path(RUTA_CLAVE).read_text(encoding="utf-8").strip()
    except Exception:
        CLAVE = ""
BASE = Path(__file__).resolve().parent
MOTOR = BASE / "bin" / "motor_biometrico"
VERSION_CONTRATO = "1.0"
CAPTURAS = {}
PROCESOS = {}
BLOQUEO = Lock()
CAPTURA_ACTIVA = None


def ahora_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# Límites del contrato: las plantillas son JSON/Base64, no imágenes sin comprimir.
MAX_SALIDA_MOTOR = 4 * 1024 * 1024
MAX_DIAGNOSTICO_MOTOR = 128 * 1024


def detener_proceso(proceso):
    """Detiene el grupo del motor sin matar al servicio Python."""
    if proceso.poll() is not None:
        return
    try:
        os.killpg(proceso.pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        try:
            proceso.terminate()
        except OSError:
            pass
    try:
        proceso.wait(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proceso.pid, signal.SIGKILL)
        except (OSError, ProcessLookupError):
            try:
                proceso.kill()
            except OSError:
                pass
        proceso.wait(timeout=2)


def ejecutar_motor(argumentos, timeout=None, id_captura=None, al_progreso=None):
    """Drena stdout y stderr simultáneamente y limita memoria/tiempo.

    No registra ni propaga el stdout del motor: podría contener una plantilla.
    """
    proceso = subprocess.Popen(
        [str(MOTOR), *argumentos],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(BASE),
        start_new_session=True,
    )
    if id_captura:
        with BLOQUEO:
            PROCESOS[id_captura] = proceso
            cancelada = CAPTURAS.get(id_captura, {}).get("estado") == "cancelada"
        if cancelada:
            detener_proceso(proceso)
            with BLOQUEO:
                PROCESOS.pop(id_captura, None)
            raise RuntimeError("La captura fue cancelada.")

    stdout_partes = []
    excedido = Event()

    def leer_stdout():
        total = 0
        while True:
            bloque = os.read(proceso.stdout.fileno(), 65536)
            if not bloque:
                break
            total += len(bloque)
            if total > MAX_SALIDA_MOTOR:
                excedido.set()
                continue  # Drenar sin retener datos adicionales.
            stdout_partes.append(bloque)

    def leer_stderr():
        total = 0
        pendiente = b""
        while True:
            bloque = os.read(proceso.stderr.fileno(), 4096)
            if not bloque:
                break
            total += len(bloque)
            if total > MAX_DIAGNOSTICO_MOTOR:
                excedido.set()
                continue
            if not al_progreso:
                continue
            pendiente += bloque
            while b"\n" in pendiente:
                linea, pendiente = pendiente.split(b"\n", 1)
                # El contrato de progreso solo acepta señales reconocidas;
                # nunca reenviar mensajes arbitrarios que contengan una plantilla.
                texto = linea.decode("utf-8", errors="replace").strip()
                bajo = texto.lower()
                if ("etapa " in bajo and " completada" in bajo) or "repetir captura" in bajo:
                    al_progreso(texto[:240])
            if len(pendiente) > 4096:
                pendiente = pendiente[-4096:]

    lectores = [Thread(target=leer_stdout, daemon=True), Thread(target=leer_stderr, daemon=True)]
    for hilo in lectores:
        hilo.start()
    inicio = time.monotonic()
    try:
        while proceso.poll() is None:
            if excedido.is_set():
                detener_proceso(proceso)
                raise RuntimeError("El motor excedió el límite de respuesta permitido.")
            if timeout is not None and time.monotonic() - inicio > timeout:
                detener_proceso(proceso)
                raise subprocess.TimeoutExpired([str(MOTOR), "<operacion>"], timeout)
            time.sleep(0.02)
        for hilo in lectores:
            hilo.join(timeout=2)
        if excedido.is_set():
            raise RuntimeError("El motor excedió el límite de respuesta permitido.")
    finally:
        if proceso.poll() is None:
            detener_proceso(proceso)
        for hilo in lectores:
            hilo.join(timeout=2)
        if id_captura:
            with BLOQUEO:
                PROCESOS.pop(id_captura, None)
        # Subprocess pipes must be closed also on timeout/size errors.
        proceso.stdout.close()
        proceso.stderr.close()

    salida = b"".join(stdout_partes).decode("utf-8", errors="replace").strip().splitlines()
    if not salida:
        raise RuntimeError("El motor biométrico no devolvió una respuesta válida.")
    try:
        datos = json.loads(salida[-1])
    except json.JSONDecodeError as exc:
        raise RuntimeError("El motor biométrico devolvió una respuesta no válida.") from exc
    if not isinstance(datos, dict):
        raise RuntimeError("El motor biométrico devolvió una estructura no válida.")
    return proceso.returncode, datos


def consultar_lector():
    if not MOTOR.exists():
        return {"disponible": False, "hardware_detectado": False, "modelo": "DigitalPersona U.are.U 4500", "estado": "motor_no_instalado"}
    try:
        codigo, datos = ejecutar_motor(["estado"], timeout=5)
        if codigo == 0 and datos.get("correcto"):
            lector = datos.get("lector", {})
            return {
                "disponible": True,
                "simulado": False,
                "hardware_detectado": True,
                "modelo": lector.get("modelo", "DigitalPersona U.are.U 4500"),
                "driver": lector.get("driver", "libfprint"),
                "identificacion_1_n": bool(lector.get("identificacion_1_n")),
                "etapas_enrolamiento": lector.get("etapas_enrolamiento"),
                "estado": "listo",
            }
        return {"disponible": False, "simulado": False, "hardware_detectado": False, "modelo": "DigitalPersona U.are.U 4500", "estado": "no_disponible"}
    except Exception:
        return {"disponible": False, "simulado": False, "hardware_detectado": False, "modelo": "DigitalPersona U.are.U 4500", "estado": "no_disponible"}


def crear_archivo_plantilla(base64_texto, carpeta, nombre):
    import base64
    datos = base64.b64decode(base64_texto, validate=True)
    ruta = Path(carpeta) / nombre
    ruta.write_bytes(datos)
    os.chmod(ruta, 0o600)
    return str(ruta)


def finalizar_captura(captura, estado, resultado=None, error=None):
    global CAPTURA_ACTIVA
    with BLOQUEO:
        if captura.get("estado") == "cancelada":
            if CAPTURA_ACTIVA == captura["id"]:
                CAPTURA_ACTIVA = None
            return
        captura["estado"] = estado
        captura["resultado"] = resultado
        captura["error"] = error
        captura["finalizada_en"] = ahora_iso()
        if CAPTURA_ACTIVA == captura["id"]:
            CAPTURA_ACTIVA = None


def ejecutar_captura(captura, cuerpo):
    operacion = captura["operacion"]
    tiempo = max(1, min(120, int(cuerpo.get("tiempo_limite_segundos", 30))))
    try:
        if operacion == "enrolamiento":
            def registrar_progreso(linea):
                texto = linea.lower()
                with BLOQUEO:
                    if captura.get("estado") == "cancelada":
                        return
                    captura["estado"] = "procesando"
                    progreso = captura["progreso"]
                    if "etapa " in texto and " completada" in texto:
                        try:
                            etapa = int(texto.split("etapa ", 1)[1].split(" ", 1)[0])
                        except (ValueError, IndexError):
                            etapa = progreso["etapa_actual"]
                        progreso.update({
                            "etapa_actual": etapa,
                            "requiere_repetir": False,
                            "mensaje": f"Captura {etapa} aceptada. Retire el dedo y vuelva a colocarlo.",
                        })
                    elif "repetir captura" in texto:
                        progreso.update({
                            "requiere_repetir": True,
                            "mensaje": "La muestra no tuvo calidad suficiente. Retire el dedo e inténtelo de nuevo.",
                        })

            codigo, datos = ejecutar_motor(
                ["enrolar", captura["usuario_id"]],
                timeout=tiempo + 10,
                id_captura=captura["id"],
                al_progreso=registrar_progreso,
            )
        elif operacion == "verificacion":
            plantilla = cuerpo.get("plantilla_biometrica")
            if not plantilla:
                raise ValueError("No se recibió una plantilla para verificar.")
            with tempfile.TemporaryDirectory(prefix="biometria-") as carpeta:
                ruta = crear_archivo_plantilla(plantilla, carpeta, "plantilla.bin")
                codigo, datos = ejecutar_motor(["verificar", ruta], timeout=tiempo + 10, id_captura=captura["id"])
        elif operacion == "identificacion":
            plantillas = cuerpo.get("plantillas") or []
            if not plantillas:
                raise ValueError("No se recibieron plantillas candidatas.")
            with tempfile.TemporaryDirectory(prefix="biometria-") as carpeta:
                rutas = []
                for indice, item in enumerate(plantillas):
                    valor = item.get("plantilla_biometrica")
                    if valor:
                        rutas.append(crear_archivo_plantilla(valor, carpeta, f"plantilla_{indice}.bin"))
                if not rutas:
                    raise ValueError("No hay plantillas válidas para identificar.")
                codigo, datos = ejecutar_motor(["identificar", *rutas], timeout=tiempo + 10, id_captura=captura["id"])
        else:
            raise ValueError("Operación biométrica desconocida.")

        if codigo == 0 and datos.get("correcto"):
            finalizar_captura(captura, "completada", datos.get("resultado"), None)
            return
        error_motor = datos.get("error") or {}
        finalizar_captura(captura, "error", None, {
            "codigo": error_motor.get("codigo", "ERROR_BIOMETRICO"),
            "mensaje": error_motor.get("mensaje", "No fue posible completar la captura biométrica."),
        })
    except subprocess.TimeoutExpired:
        finalizar_captura(captura, "tiempo_agotado", None, {"codigo": "TIEMPO_AGOTADO", "mensaje": "Se agotó el tiempo de la operación biométrica."})
    except Exception as exc:
        finalizar_captura(captura, "error", None, {"codigo": "ERROR_BIOMETRICO", "mensaje": str(exc)[:240]})


class Manejador(BaseHTTPRequestHandler):
    server_version = "PuenteBiometricoReal/1.0"

    def log_message(self, formato, *args):
        # Evita registrar cabeceras o contenido sensible.
        print("[puente-real] " + (formato % args))

    def responder(self, estado, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(cuerpo)

    def autorizado(self):
        recibido = self.headers.get("Authorization", "")
        esperado = f"Bearer {CLAVE}"
        return bool(CLAVE) and hmac.compare_digest(recibido, esperado)

    def leer_json(self):
        longitud = int(self.headers.get("Content-Length", "0") or 0)
        if longitud <= 0 or longitud > 2_000_000:
            return {}
        return json.loads(self.rfile.read(longitud).decode("utf-8"))

    def autenticar(self):
        if self.autorizado():
            return True
        self.responder(401, {"correcto": False, "error": {"codigo": "NO_AUTORIZADO", "mensaje": "Acceso no autorizado."}})
        return False

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta == "/":
            cuerpo = b"Puente biometrico real activo. Use /v1/salud desde el servidor principal."
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        if not self.autenticar():
            return
        if ruta == "/v1/salud":
            self.responder(200, {"correcto": True, "servicio": "puente_biometrico", "version_contrato": VERSION_CONTRATO, "modo": "real", "mensaje": "Puente biométrico real disponible."})
            return
        if ruta == "/v1/lector":
            lector = consultar_lector()
            self.responder(200, {"correcto": True, "version_contrato": VERSION_CONTRATO, "modo": "real", "lector": lector, "mensaje": "Lector biométrico real disponible." if lector.get("disponible") else "Lector biométrico real no disponible."})
            return
        if ruta.startswith("/v1/capturas/"):
            id_captura = ruta.rsplit("/", 1)[-1]
            with BLOQUEO:
                captura = CAPTURAS.get(id_captura)
                copia = dict(captura) if captura else None
            if not copia:
                self.responder(404, {"correcto": False, "error": {"codigo": "CAPTURA_NO_ENCONTRADA", "mensaje": "La captura no existe."}})
                return
            self.responder(200, {"correcto": True, "version_contrato": VERSION_CONTRATO, "captura": copia})
            return
        self.responder(404, {"correcto": False, "error": {"codigo": "RUTA_NO_ENCONTRADA", "mensaje": "Ruta no encontrada."}})

    def do_POST(self):
        global CAPTURA_ACTIVA
        ruta = urlparse(self.path).path
        if not self.autenticar():
            return
        if ruta != "/v1/capturas":
            self.responder(404, {"correcto": False, "error": {"codigo": "RUTA_NO_ENCONTRADA", "mensaje": "Ruta no encontrada."}})
            return
        try:
            cuerpo = self.leer_json()
        except Exception:
            self.responder(400, {"correcto": False, "error": {"codigo": "SOLICITUD_INVALIDA", "mensaje": "JSON inválido."}})
            return
        operacion = str(cuerpo.get("operacion", "")).lower()
        if operacion not in {"enrolamiento", "verificacion", "identificacion"}:
            self.responder(400, {"correcto": False, "error": {"codigo": "SOLICITUD_INVALIDA", "mensaje": "Operación inválida."}})
            return
        try:
            tiempo = int(cuerpo.get("tiempo_limite_segundos", 30))
            if not 1 <= tiempo <= 120:
                raise ValueError("Fuera de rango")
        except (ValueError, TypeError):
            self.responder(400, {"correcto": False, "error": {"codigo": "SOLICITUD_INVALIDA", "mensaje": "El tiempo límite debe estar entre 1 y 120 segundos."}})
            return
        lector = consultar_lector()
        if not lector.get("disponible"):
            self.responder(503, {"correcto": False, "error": {"codigo": "LECTOR_NO_DISPONIBLE", "mensaje": "El lector biométrico real no está disponible."}})
            return
        with BLOQUEO:
            if CAPTURA_ACTIVA:
                self.responder(409, {"correcto": False, "error": {"codigo": "CAPTURA_EN_CURSO", "mensaje": "Ya existe una captura en curso."}})
                return
            identificador = "cap_" + secrets.token_hex(8)
            captura = {
                "id": identificador,
                "operacion": operacion,
                "estado": "esperando_dedo",
                "modo": "real",
                "usuario_id": str(cuerpo.get("usuario_id") or ""),
                "creada_en": ahora_iso(),
                "vence_en": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + tiempo)),
                "finalizada_en": None,
                "resultado": None,
                "error": None,
                "progreso": {
                    "etapa_actual": 0,
                    "etapas_totales": int(lector.get("etapas_enrolamiento") or 1) if operacion == "enrolamiento" else 1,
                    "requiere_repetir": False,
                    "mensaje": "Coloque el dedo sobre el sensor." if operacion == "enrolamiento" else "Esperando una lectura válida.",
                },
            }
            CAPTURAS[identificador] = captura
            CAPTURA_ACTIVA = identificador
        Thread(target=ejecutar_captura, args=(captura, cuerpo), daemon=True).start()
        self.responder(202, {"correcto": True, "version_contrato": VERSION_CONTRATO, "captura": dict(captura), "mensaje": "Captura biométrica real iniciada."})

    def do_DELETE(self):
        global CAPTURA_ACTIVA
        ruta = urlparse(self.path).path
        if not self.autenticar():
            return
        if not ruta.startswith("/v1/capturas/"):
            self.responder(404, {"correcto": False, "error": {"codigo": "RUTA_NO_ENCONTRADA", "mensaje": "Ruta no encontrada."}})
            return
        identificador = ruta.rsplit("/", 1)[-1]
        proceso = None
        with BLOQUEO:
            captura = CAPTURAS.get(identificador)
            if not captura:
                self.responder(404, {"correcto": False, "error": {"codigo": "CAPTURA_NO_ENCONTRADA", "mensaje": "La captura no existe."}})
                return
            if captura["estado"] in {"esperando_dedo", "procesando"}:
                captura["estado"] = "cancelada"
                captura["finalizada_en"] = ahora_iso()
                captura["error"] = {"codigo": "CAPTURA_CANCELADA", "mensaje": "La captura fue cancelada."}
                proceso = PROCESOS.get(identificador)
                # No liberar CAPTURA_ACTIVA hasta que el hilo concluya.
                # Mantener reservado el dispositivo hasta que el proceso de
                # libfprint se detenga realmente. Evita capturas simultáneas
                # al pulsar Cancelar y Registrar de inmediato.
            copia = dict(captura)
        if proceso and proceso.poll() is None:
            detener_proceso(proceso)
        self.responder(200, {"correcto": True, "version_contrato": VERSION_CONTRATO, "captura": copia, "mensaje": "Cancelación solicitada."})


def limpiar_capturas_antiguas():
    while True:
        time.sleep(60)
        limite = time.time() - 600
        with BLOQUEO:
            eliminar = []
            for identificador, captura in CAPTURAS.items():
                final = captura.get("finalizada_en")
                if final and captura.get("estado") not in {"esperando_dedo", "procesando"}:
                    try:
                        ts = calendar.timegm(time.strptime(final, "%Y-%m-%dT%H:%M:%SZ"))
                        if ts < limite:
                            eliminar.append(identificador)
                    except Exception:
                        pass
            for identificador in eliminar:
                CAPTURAS.pop(identificador, None)


if __name__ == "__main__":
    if not CLAVE or len(CLAVE) < 24:
        raise SystemExit("Falta CLAVE_LOCAL_PUENTE con mínimo 24 caracteres.")
    Thread(target=limpiar_capturas_antiguas, daemon=True).start()
    servidor = ThreadingHTTPServer((HOST, PORT), Manejador)
    print(f"Puente biométrico real escuchando en http://{HOST}:{PORT}")
    servidor.serve_forever()
