# INFORME GIT Y GITHUB
## Sistema web de control de asistencia

Repositorio del proyecto: https://github.com/cannalombia/SistemaDeAsistenciaADSO

Este informe muestra de forma sencilla cómo se organizó el proyecto con Git, cómo se hicieron los commits y cómo se subió finalmente a GitHub.

# 1. Entrar a la carpeta del proyecto

Primero se abrió Git Bash dentro de la carpeta del proyecto:

    cd "/c/Users/Usuario/Desktop/BLUE MAGIC/VERSION 5 HTML COMPLETO"

Después se verificó que Git reconociera correctamente el repositorio:

    git status

# 2. Solución al problema de permisos de Git

Git mostró un mensaje de seguridad indicando que la carpeta pertenecía a otro usuario del sistema.

El error era parecido a:

    fatal: detected dubious ownership in repository

La solución fue autorizar solamente la carpeta del proyecto:

    git config --global --add safe.directory "C:/Users/Usuario/Desktop/BLUE MAGIC/VERSION 5 HTML COMPLETO"

Después se volvió a comprobar:

    git status -sb

Resultado:

    ## main

Esto confirmó que Git ya reconocía correctamente la rama principal.

# 3. Commits realizados

Un commit es un punto de guardado del proyecto. Cada commit deja registrada una mejora concreta.

## Commit 1 - Organizar la arquitectura y proteger datos locales

Comando utilizado:

    git commit -m "refactor: organizar arquitectura y proteger datos locales"

Se usó para organizar mejor la estructura del proyecto y evitar que archivos locales o sensibles quedaran incluidos incorrectamente en Git.

## Commit 2 - Documentar el CRUD de usuarios

Comando utilizado:

    git commit -m "feat: documentar comandos de clase en el CRUD de usuarios"

Se usó para guardar la documentación relacionada con el CRUD de usuarios y dejar evidencia del proceso de desarrollo.

## Commit 3 - Simplificar el CRUD y organizar las rutas

Comando utilizado:

    git commit -m "refactor: simplificar CRUD y organizar rutas del servidor"

Se utilizó para mejorar la organización del servidor y hacer más sencilla la lógica del CRUD.

## Commit 4 - Simplificar la autenticación y el CRUD

Comando utilizado:

    git commit -m "refactor: simplificar autenticacion y CRUD"

Se utilizó para mejorar el funcionamiento de la autenticación y continuar simplificando el CRUD.

## Commit 5 - Mejorar la seguridad de las credenciales

Comando utilizado:

    git commit -m "security: retirar credenciales integradas del código y preparar configuración segura"

Se utilizó para retirar credenciales que estaban escritas directamente en el código y pasarlas a una configuración más segura.

También se dejó el archivo .env fuera del repositorio para evitar subir información privada.

## Commit 6 - Actualizar la documentación final con MySQL

Comando utilizado:

    git commit -m "docs: actualizar documentación final de Blue Magic V5 con MySQL"

Este commit dejó actualizada la documentación del proyecto después de implementar MySQL como base de datos principal.

Aunque el mensaje histórico del commit conserva el nombre usado en ese momento, el nombre formal del proyecto es Sistema web de control de asistencia.

# 4. Ver los commits realizados

Para revisar el historial se utilizó:

    git log --oneline --decorate -10

Git mostró los seis commits realizados, confirmando que el proyecto tenía un historial de cambios guardado correctamente.

# 5. Conectar el proyecto con GitHub

Primero se comprobó si el proyecto ya tenía un repositorio remoto:

    git remote -v

Al principio no apareció ningún resultado, por lo que todavía no estaba conectado con GitHub.

Se agregó el repositorio:

    git remote add origin https://github.com/cannalombia/SistemaDeAsistenciaADSO.git

Luego se verificó:

    git remote -v

Resultado:

    origin  https://github.com/cannalombia/SistemaDeAsistenciaADSO.git (fetch)
    origin  https://github.com/cannalombia/SistemaDeAsistenciaADSO.git (push)

# 6. Revisar si GitHub ya tenía información

Antes de subir el proyecto se comprobó si el repositorio remoto ya tenía una rama principal:

    git ls-remote --heads origin

Git mostró que ya existía una rama main.

Por eso no se hizo un push directamente.

Primero se descargó la información del repositorio remoto:

    git fetch origin

Después se comparó el historial remoto con el local:

    git rev-list --left-right --count origin/main...main

Resultado:

    1       6

Esto significaba que GitHub tenía un commit antiguo y el proyecto local tenía seis commits nuevos.

# 7. Guardar una copia de la versión antigua de GitHub

Antes de reemplazar la versión antigua se creó una rama de respaldo:

    git branch backup-github-antiguo origin/main

Después se subió ese respaldo también a GitHub:

    git push origin backup-github-antiguo

De esta forma la versión anterior quedó conservada.

# 8. Subir la versión actual del proyecto

Después de comprobar que el proyecto estaba limpio:

    git status

Git mostró:

    nothing to commit, working tree clean

Entonces se subió la versión actual:

    git push --force-with-lease -u origin main

Se utilizó --force-with-lease porque el repositorio remoto tenía un historial diferente. Esta opción permite actualizar la rama principal de una manera más controlada que usar --force directamente.

Git confirmó:

    main -> main

y dejó la rama local conectada con origin/main.

# 9. Verificación final

Para comprobar que el proyecto local y GitHub quedaron iguales se ejecutó:

    git status -sb

Resultado:

    ## main...origin/main

Esto significa que no había commits pendientes por subir ni por descargar.

También se comprobó el historial:

    git log --oneline --decorate -10

La rama local main y la rama remota origin/main quedaron apuntando a la misma versión.

# 10. Cambio al nombre definitivo del repositorio

El repositorio pasó a utilizar el nombre definitivo:

    SistemaDeAsistenciaADSO

Por eso se actualizó la dirección de origin:

    git remote set-url origin https://github.com/cannalombia/SistemaDeAsistenciaADSO.git

Después se comprobó:

    git remote -v

y se actualizó la información remota:

    git fetch origin

Finalmente:

    git status -sb

Resultado:

    ## main...origin/main

# 11. Errores encontrados y solución

## Error 1 - Git no reconocía la carpeta como segura

Mensaje:

    fatal: detected dubious ownership in repository

Causa:

La carpeta .git había sido creada o modificada por otro usuario del sistema.

Solución:

    git config --global --add safe.directory "C:/Users/Usuario/Desktop/BLUE MAGIC/VERSION 5 HTML COMPLETO"

## Error 2 - Aparecían caracteres extra al pegar comandos

Mensaje:

    ^[[200~git
    command not found

Causa:

Git Bash recibió caracteres especiales al pegar el texto.

Solución:

Se volvió a escribir el comando limpio, sin copiar los caracteres extra.

## Error 3 - origin/main no existía

Mensaje:

    fatal: ambiguous argument 'origin/main..HEAD'

Causa:

Todavía no se había configurado el repositorio remoto.

Solución:

    git remote add origin https://github.com/cannalombia/SistemaDeAsistenciaADSO.git

Después:

    git fetch origin

## Error 4 - GitHub ya tenía una versión antigua

Se detectó con:

    git ls-remote --heads origin

Solución:

Se revisó primero el historial remoto, se creó una rama de respaldo y después se actualizó main.

## Error 5 - El historial local y el remoto eran diferentes

Se comprobó con:

    git merge-base origin/main main

No apareció ningún resultado, lo que indicó que ambos historiales habían sido creados de forma independiente.

Solución:

Se guardó la versión antigua en:

    backup-github-antiguo

y después se publicó la versión actual con:

    git push --force-with-lease -u origin main

# 12. Comandos básicos para futuros cambios

Para revisar cambios:

    git status

Para agregar los archivos:

    git add .

Para crear un nuevo commit:

    git commit -m "descripcion del cambio"

Para subirlo a GitHub:

    git push

Para comprobar que todo quedó sincronizado:

    git status -sb

# 13. Estado final

Proyecto: Sistema web de control de asistencia

Repositorio: SistemaDeAsistenciaADSO

Rama principal: main

Rama de respaldo: backup-github-antiguo

Estado local y remoto: sincronizados

Cambios pendientes: ninguno

Git y GitHub: funcionando correctamente

# 14. Resumen fácil para exposición

El proyecto se trabajó con Git para guardar cada avance mediante commits. Primero se organizaron los archivos y se protegieron los datos locales. Después se hicieron commits para documentar el CRUD, organizar las rutas, simplificar la autenticación, mejorar la seguridad y actualizar la documentación con MySQL.

Luego el proyecto se conectó con GitHub. Como en GitHub ya existía una versión antigua, primero se creó una rama de respaldo para no perderla. Después se subió la versión actual del proyecto y finalmente se comprobó que la rama local main y la rama remota origin/main quedaran completamente sincronizadas.
