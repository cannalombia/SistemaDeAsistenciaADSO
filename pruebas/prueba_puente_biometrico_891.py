"""Regresión para captura: tuberías grandes, límites de tamaño y timeout.
No requiere DigitalPersona, servidor HTTP, credenciales ni plantillas reales.
"""
import importlib.util
import os
import pathlib
import stat
import tempfile
import unittest
from unittest.mock import patch

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("puente_891", RAIZ / "puente_biometrico_real" / "servidor_real.py")
PUENTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PUENTE)


class MotorSalidasGrandes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="motor_bio_891_")
        self.script = pathlib.Path(self.tmp.name) / "motor_falso"

    def tearDown(self):
        self.tmp.cleanup()

    def preparar(self, codigo):
        self.script.write_text("#!/usr/bin/env python3\n" + codigo, encoding="utf-8")
        self.script.chmod(stat.S_IRWXU)

    def ejecutar(self, timeout=5, progreso=None):
        with patch.object(PUENTE, "MOTOR", self.script):
            return PUENTE.ejecutar_motor(["estado"], timeout=timeout, al_progreso=progreso)

    def test_stdout_cientos_kb_y_stderr_al_mismo_tiempo(self):
        self.preparar('''import sys,json
sys.stdout.write(" " * (400 * 1024))
sys.stderr.write("diagnostico\\n" * 4000)
sys.stdout.write(json.dumps({"correcto": True, "resultado": {"ok": True}}) + "\\n")
''')
        codigo, respuesta = self.ejecutar()
        self.assertEqual(codigo, 0)
        self.assertTrue(respuesta["resultado"]["ok"])

    def test_stdout_y_stderr_megabytes_no_bloquean(self):
        self.preparar('''import sys,json
sys.stdout.write(" " * (2 * 1024 * 1024))
sys.stderr.write(" " * (60 * 1024))
sys.stdout.write(json.dumps({"correcto": True}) + "\\n")
''')
        codigo, respuesta = self.ejecutar()
        self.assertEqual(codigo, 0)
        self.assertTrue(respuesta["correcto"])

    def test_exceso_de_salida_no_filtra_plantilla(self):
        self.preparar('''import sys
sys.stdout.write("TEXTO_BIOMETRICO_PRIVADO" * 300000)
sys.stdout.flush()
''')
        with self.assertRaisesRegex(RuntimeError, "límite") as error:
            self.ejecutar()
        self.assertNotIn("TEXTO_BIOMETRICO_PRIVADO", str(error.exception))

    def test_timeout_termina_el_proceso(self):
        self.preparar('''import time
while True:
    time.sleep(1)
''')
        import subprocess
        with self.assertRaises(subprocess.TimeoutExpired):
            self.ejecutar(timeout=.15)

    def test_progreso_solo_emite_senales_conocidas(self):
        self.preparar('''import sys,json
sys.stderr.write("token privada\\nEtapa 1 completada\\nrepetir captura\\n")
sys.stdout.write(json.dumps({"correcto": True}) + "\\n")
''')
        eventos = []
        self.ejecutar(progreso=eventos.append)
        self.assertEqual(len(eventos), 2)
        self.assertNotIn("token", " ".join(eventos))

if __name__ == "__main__":
    unittest.main(verbosity=2)
