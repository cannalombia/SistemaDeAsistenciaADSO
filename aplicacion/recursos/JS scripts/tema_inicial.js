// Aplicación temprana del tema guardado. Solo presentación; no cambia permisos ni datos.
(function () {
    "use strict";

    let dark = false;
    try {
        dark = localStorage.getItem("sena-dark-mode") === "1";
    } catch (_) {
        dark = false;
    }

    if (document.body) document.body.classList.toggle("dark-mode", dark);
})();
