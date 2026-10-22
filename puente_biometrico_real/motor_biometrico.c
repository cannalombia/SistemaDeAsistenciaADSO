/*
    Archivo: motor_biometrico.c

    Propósito:
    Comunicarse directamente con libfprint para usar el lector DigitalPersona
    U.are.U 4500 desde Ubuntu/WSL2.

    Responsabilidad:
    - Detectar y abrir el lector.
    - Enrolar una huella real.
    - Verificar una plantilla conocida.
    - Identificar una huella contra una galería de plantillas.
    - Serializar plantillas sin guardar imágenes.

    Comunicación:
    El servidor HTTP del puente ejecuta este programa como proceso local.

    Límites:
    No conoce usuarios del sistema web, no registra asistencias, no cifra archivos
    y nunca guarda imágenes de huella en disco.
*/

#include <fprint.h>
#include <glib.h>
#include <gio/gio.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void imprimir_json_error(const char *codigo, const char *mensaje) {
    gchar *codigo_esc = g_strescape(codigo ? codigo : "ERROR_INTERNO", NULL);
    gchar *mensaje_esc = g_strescape(mensaje ? mensaje : "Error biométrico.", NULL);
    printf("{\"correcto\":false,\"error\":{\"codigo\":\"%s\",\"mensaje\":\"%s\"}}\n", codigo_esc, mensaje_esc);
    g_free(codigo_esc);
    g_free(mensaje_esc);
}

static FpDevice *obtener_lector(FpContext **contexto_salida, GError **error) {
    FpContext *contexto = fp_context_new();
    fp_context_enumerate(contexto);
    GPtrArray *dispositivos = fp_context_get_devices(contexto);
    if (!dispositivos || dispositivos->len == 0) {
        g_set_error_literal(error, G_IO_ERROR, G_IO_ERROR_NOT_FOUND, "No se encontró un lector compatible con libfprint.");
        g_object_unref(contexto);
        return NULL;
    }
    FpDevice *lector = g_object_ref(g_ptr_array_index(dispositivos, 0));
    *contexto_salida = contexto;
    return lector;
}

static gboolean abrir_lector(FpDevice *lector, GError **error) {
    if (fp_device_is_open(lector)) return TRUE;
    return fp_device_open_sync(lector, NULL, error);
}

static void cerrar_lector(FpDevice *lector) {
    if (!lector) return;
    if (fp_device_is_open(lector)) {
        GError *error = NULL;
        fp_device_close_sync(lector, NULL, &error);
        if (error) g_error_free(error);
    }
}

static void progreso_enrolamiento(FpDevice *device, gint etapas_completadas, FpPrint *print, gpointer user_data, GError *error) {
    (void)device; (void)print; (void)user_data;
    if (error) {
        fprintf(stderr, "Enrolamiento: repetir captura (%s).\n", error->message);
        fflush(stderr);
        return;
    }
    fprintf(stderr, "Enrolamiento: etapa %d completada.\n", etapas_completadas);
    fflush(stderr);
}

static gboolean leer_archivo(const char *ruta, guchar **datos, gsize *longitud, GError **error) {
    gchar *contenido = NULL;
    gsize tamano = 0;
    if (!g_file_get_contents(ruta, &contenido, &tamano, error)) return FALSE;
    *datos = (guchar *)contenido;
    *longitud = tamano;
    return TRUE;
}

static int comando_estado(void) {
    GError *error = NULL;
    FpContext *contexto = NULL;
    FpDevice *lector = obtener_lector(&contexto, &error);
    if (!lector) {
        imprimir_json_error("LECTOR_NO_DISPONIBLE", error ? error->message : "No hay lector.");
        if (error) g_error_free(error);
        return 2;
    }
    const char *nombre = fp_device_get_name(lector);
    const char *driver = fp_device_get_driver(lector);
    gboolean identifica = fp_device_has_feature(lector, FP_DEVICE_FEATURE_IDENTIFY);
    gint etapas = fp_device_get_nr_enroll_stages(lector);
    gchar *nombre_esc = g_strescape(nombre ? nombre : "Lector biométrico", NULL);
    gchar *driver_esc = g_strescape(driver ? driver : "desconocido", NULL);
    printf("{\"correcto\":true,\"lector\":{\"disponible\":true,\"modelo\":\"%s\",\"driver\":\"%s\",\"identificacion_1_n\":%s,\"etapas_enrolamiento\":%d}}\n",
        nombre_esc, driver_esc, identifica ? "true" : "false", etapas);
    g_free(nombre_esc);
    g_free(driver_esc);
    g_object_unref(lector);
    g_object_unref(contexto);
    return 0;
}

static int comando_enrolar(const char *usuario_id) {
    GError *error = NULL;
    FpContext *contexto = NULL;
    FpDevice *lector = obtener_lector(&contexto, &error);
    if (!lector || !abrir_lector(lector, &error)) {
        imprimir_json_error("LECTOR_NO_DISPONIBLE", error ? error->message : "No fue posible abrir el lector.");
        if (error) g_error_free(error);
        if (lector) g_object_unref(lector);
        if (contexto) g_object_unref(contexto);
        return 2;
    }

    FpPrint *plantilla = fp_print_new(lector);
    fp_print_set_username(plantilla, usuario_id);
    fp_print_set_finger(plantilla, FP_FINGER_RIGHT_INDEX);
    FpPrint *resultado = fp_device_enroll_sync(lector, plantilla, NULL, progreso_enrolamiento, NULL, &error);
    if (!resultado) {
        imprimir_json_error("MUESTRA_INVALIDA", error ? error->message : "No se pudo completar el enrolamiento.");
        if (error) g_error_free(error);
        cerrar_lector(lector);
        g_object_unref(lector);
        g_object_unref(contexto);
        return 3;
    }

    guchar *serializada = NULL;
    gsize longitud = 0;
    if (!fp_print_serialize(resultado, &serializada, &longitud, &error)) {
        imprimir_json_error("ERROR_INTERNO", error ? error->message : "No se pudo serializar la plantilla.");
        if (error) g_error_free(error);
        g_object_unref(resultado);
        cerrar_lector(lector);
        g_object_unref(lector);
        g_object_unref(contexto);
        return 4;
    }

    gchar *base64 = g_base64_encode(serializada, longitud);
    gchar *usuario_esc = g_strescape(usuario_id, NULL);
    printf("{\"correcto\":true,\"resultado\":{\"enrolamiento_completado\":true,\"usuario_id\":\"%s\",\"dedo\":\"indice_derecho\",\"calidad\":\"aceptada\",\"plantilla_biometrica\":\"%s\"}}\n", usuario_esc, base64);

    g_free(usuario_esc);
    g_free(base64);
    g_free(serializada);
    g_object_unref(resultado);
    cerrar_lector(lector);
    g_object_unref(lector);
    g_object_unref(contexto);
    return 0;
}

static FpPrint *cargar_plantilla(const char *ruta, GError **error) {
    guchar *datos = NULL;
    gsize longitud = 0;
    if (!leer_archivo(ruta, &datos, &longitud, error)) return NULL;
    FpPrint *print = fp_print_deserialize(datos, longitud, error);
    g_free(datos);
    return print;
}

static int comando_verificar(const char *ruta_plantilla) {
    GError *error = NULL;
    FpPrint *plantilla = cargar_plantilla(ruta_plantilla, &error);
    if (!plantilla) {
        imprimir_json_error("PLANTILLA_INVALIDA", error ? error->message : "No se pudo leer la plantilla.");
        if (error) g_error_free(error);
        return 3;
    }

    FpContext *contexto = NULL;
    FpDevice *lector = obtener_lector(&contexto, &error);
    if (!lector || !abrir_lector(lector, &error)) {
        imprimir_json_error("LECTOR_NO_DISPONIBLE", error ? error->message : "No fue posible abrir el lector.");
        if (error) g_error_free(error);
        g_object_unref(plantilla);
        if (lector) g_object_unref(lector);
        if (contexto) g_object_unref(contexto);
        return 2;
    }

    if (!fp_print_compatible(plantilla, lector)) {
        imprimir_json_error("PLANTILLA_INCOMPATIBLE", "La plantilla no es compatible con este lector.");
        cerrar_lector(lector);
        g_object_unref(lector);
        g_object_unref(contexto);
        g_object_unref(plantilla);
        return 4;
    }

    gboolean coincide = FALSE;
    FpPrint *capturada = NULL;
    gboolean operacion_ok = fp_device_verify_sync(lector, plantilla, NULL, NULL, NULL, &coincide, &capturada, &error);
    if (!operacion_ok) {
        imprimir_json_error("MUESTRA_INVALIDA", error ? error->message : "No fue posible verificar la huella.");
        if (error) g_error_free(error);
    } else {
        printf("{\"correcto\":true,\"resultado\":{\"coincidencia\":%s,\"calidad\":\"aceptada\"}}\n", coincide ? "true" : "false");
    }

    if (capturada) g_object_unref(capturada);
    cerrar_lector(lector);
    g_object_unref(lector);
    g_object_unref(contexto);
    g_object_unref(plantilla);
    return operacion_ok ? 0 : 5;
}

static int comando_identificar(int cantidad, char **rutas) {
    GError *error = NULL;
    FpContext *contexto = NULL;
    FpDevice *lector = obtener_lector(&contexto, &error);
    if (!lector || !abrir_lector(lector, &error)) {
        imprimir_json_error("LECTOR_NO_DISPONIBLE", error ? error->message : "No fue posible abrir el lector.");
        if (error) g_error_free(error);
        if (lector) g_object_unref(lector);
        if (contexto) g_object_unref(contexto);
        return 2;
    }

    GPtrArray *galeria = g_ptr_array_new_with_free_func(g_object_unref);
    for (int i = 0; i < cantidad; i++) {
        FpPrint *plantilla = cargar_plantilla(rutas[i], &error);
        if (!plantilla) {
            imprimir_json_error("PLANTILLA_INVALIDA", error ? error->message : "No se pudo leer una plantilla.");
            if (error) g_error_free(error);
            g_ptr_array_unref(galeria);
            cerrar_lector(lector);
            g_object_unref(lector);
            g_object_unref(contexto);
            return 3;
        }
        if (fp_print_compatible(plantilla, lector)) g_ptr_array_add(galeria, plantilla);
        else g_object_unref(plantilla);
    }

    if (galeria->len == 0) {
        imprimir_json_error("SIN_PLANTILLAS", "No hay plantillas compatibles para identificar.");
        g_ptr_array_unref(galeria);
        cerrar_lector(lector);
        g_object_unref(lector);
        g_object_unref(contexto);
        return 4;
    }

    if (!fp_device_has_feature(lector, FP_DEVICE_FEATURE_IDENTIFY)) {
        imprimir_json_error("IDENTIFICACION_NO_SOPORTADA", "El controlador libfprint activo no anuncia identificación 1:N.");
        g_ptr_array_unref(galeria);
        cerrar_lector(lector);
        g_object_unref(lector);
        g_object_unref(contexto);
        return 5;
    }

    FpPrint *coincidencia = NULL;
    FpPrint *capturada = NULL;
    gboolean operacion_ok = fp_device_identify_sync(lector, galeria, NULL, NULL, NULL, &coincidencia, &capturada, &error);
    if (!operacion_ok) {
        imprimir_json_error("MUESTRA_INVALIDA", error ? error->message : "No fue posible identificar la huella.");
        if (error) g_error_free(error);
    } else if (!coincidencia) {
        printf("{\"correcto\":true,\"resultado\":{\"coincidencia\":false,\"usuario_id\":null,\"calidad\":\"aceptada\"}}\n");
    } else {
        const char *usuario = fp_print_get_username(coincidencia);
        gchar *usuario_esc = g_strescape(usuario ? usuario : "", NULL);
        printf("{\"correcto\":true,\"resultado\":{\"coincidencia\":true,\"usuario_id\":\"%s\",\"calidad\":\"aceptada\"}}\n", usuario_esc);
        g_free(usuario_esc);
    }

    if (capturada) g_object_unref(capturada);
    if (coincidencia) g_object_unref(coincidencia);
    g_ptr_array_unref(galeria);
    cerrar_lector(lector);
    g_object_unref(lector);
    g_object_unref(contexto);
    return operacion_ok ? 0 : 6;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        imprimir_json_error("SOLICITUD_INVALIDA", "Uso: motor_biometrico estado|enrolar|verificar|identificar");
        return 1;
    }
    if (strcmp(argv[1], "estado") == 0) return comando_estado();
    if (strcmp(argv[1], "enrolar") == 0 && argc == 3) return comando_enrolar(argv[2]);
    if (strcmp(argv[1], "verificar") == 0 && argc == 3) return comando_verificar(argv[2]);
    if (strcmp(argv[1], "identificar") == 0 && argc >= 3) return comando_identificar(argc - 2, &argv[2]);
    imprimir_json_error("SOLICITUD_INVALIDA", "Argumentos inválidos para el motor biométrico.");
    return 1;
}
