"""Pruebas aisladas del puente HTTP sin lector, sin plantillas y sin credenciales reales.
Ejecutar: python3 pruebas/prueba_puente_biometrico_89.py
"""
import http.client
import importlib.util
import json
import pathlib
import threading
import time
import unittest
from unittest import mock

raiz = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("puente_bio_89", raiz / "puente_biometrico_real" / "servidor_real.py")
puente = importlib.util.module_from_spec(spec)
spec.loader.exec_module(puente)


class ContratoPuente(unittest.TestCase):
    def setUp(self):
        self.original_clave = puente.CLAVE
        puente.CLAVE = "clave-exclusiva-prueba-89-mas-de-24"
        puente.CAPTURAS.clear()
        puente.PROCESOS.clear()
        puente.CAPTURA_ACTIVA = None
        self.servidor = puente.ThreadingHTTPServer(("127.0.0.1", 0), puente.Manejador)
        self.hilo = threading.Thread(target=self.servidor.serve_forever, daemon=True)
        self.hilo.start()

    def tearDown(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        self.hilo.join(timeout=2)
        puente.CLAVE = self.original_clave
        puente.CAPTURAS.clear()
        puente.PROCESOS.clear()
        puente.CAPTURA_ACTIVA = None

    def llamar(self, metodo, ruta, payload=None, clave=True):
        conexion = http.client.HTTPConnection("127.0.0.1", self.servidor.server_address[1], timeout=3)
        cabeceras = {"Content-Type": "application/json"}
        if clave:
            cabeceras["Authorization"] = f"Bearer {puente.CLAVE}"
        conexion.request(metodo, ruta, body=json.dumps(payload).encode() if payload is not None else None, headers=cabeceras)
        respuesta = conexion.getresponse()
        status = respuesta.status
        datos = json.loads(respuesta.read().decode())
        conexion.close()
        return status, datos

    def test_sin_autorizacion_no_lee_estado(self):
        codigo, datos = self.llamar("GET", "/v1/salud", clave=False)
        self.assertEqual(codigo, 401)
        self.assertEqual(datos["error"]["codigo"], "NO_AUTORIZADO")

    def test_tiempo_invalido_rechazado_sin_abrir_sensor(self):
        with mock.patch.object(puente, "consultar_lector", side_effect=AssertionError("No debe consultar lector")):
            for tiempo in (0, -5, 121, "valor-no-numerico"):
                codigo, datos = self.llamar("POST", "/v1/capturas", {"operacion": "enrolamiento", "tiempo_limite_segundos": tiempo})
                self.assertEqual(codigo, 400)
                self.assertEqual(datos["error"]["codigo"], "SOLICITUD_INVALIDA")

    def test_cancelar_no_libera_lector_hasta_terminar_proceso(self):
        arrancado = threading.Event()
        terminar = threading.Event()

        def operacion_controlada(captura, cuerpo):
            arrancado.set()
            terminar.wait(timeout=4)
            puente.finalizar_captura(captura, "completada", {"enrolamiento_completado": True})

        dispositivo = {"disponible": True, "etapas_enrolamiento": 5}
        with mock.patch.object(puente, "consultar_lector", return_value=dispositivo), mock.patch.object(puente, "ejecutar_captura", side_effect=operacion_controlada):
            codigo, primero = self.llamar("POST", "/v1/capturas", {"operacion": "enrolamiento", "usuario_id": "aprendiz-de-prueba", "tiempo_limite_segundos": 30})
            self.assertEqual(codigo, 202)
            self.assertTrue(arrancado.wait(timeout=2))
            identidad = primero["captura"]["id"]
            self.assertEqual(self.llamar("DELETE", f"/v1/capturas/{identidad}")[0], 200)
            codigo, _ = self.llamar("POST", "/v1/capturas", {"operacion": "enrolamiento", "usuario_id": "otro", "tiempo_limite_segundos": 30})
            self.assertEqual(codigo, 409, "No iniciar otro proceso mientras el anterior está terminando")
            terminar.set()
            for _ in range(40):
                if puente.CAPTURA_ACTIVA is None:
                    break
                time.sleep(.01)
            self.assertIsNone(puente.CAPTURA_ACTIVA)
            codigo, cancelada = self.llamar("GET", f"/v1/capturas/{identidad}")
            self.assertEqual(codigo, 200)
            self.assertEqual(cancelada["captura"]["estado"], "cancelada")


if __name__ == "__main__":
    unittest.main(verbosity=2)
