# VALIDACIÓN FINAL — RESILIENCIA R1

Build validado: `2026-10-12-final-resilience-r1`

## Verificaciones ejecutadas en el entorno de construcción

- Sintaxis de todos los archivos `.js`: **0 errores**.
- `prueba_resiliencia_final.js`: **OK**.
- `prueba_mysql.js`: **OK**.
- `prueba_http.js`: **OK**.
- `prueba_sidebar_visual.js`: **OK**.
- `prueba_sistema_visual.js`: **OK**.
- `prueba_tema_usuarios_estadisticas.js`: **OK**.
- `prueba_estadisticas_frontend.js`: **OK**.
- `prueba_estadisticas_analitica.js`: **OK**.
- `prueba_qr_frontend.js`: contrato frontend ejecutado; el test controla deliberadamente también la respuesta QR inválida.
- Dataset de asistencia: **0 duplicados** en la clave efectiva documento/ficha/fecha/jornada.
- Las 12 páginas HTML cargan `resiliencia_cliente.js`.

## Limitación del entorno de construcción

Se intentó `npm ci`, pero el acceso al registro de dependencias quedó bloqueado/agotó el tiempo de transporte del contenedor. Por esa razón no fue posible ejecutar aquí la suite completa que importa `qrcode`, `nodemailer`, `busboy` y `mysql2`. No se incluyó un `node_modules` parcial en el ZIP.

En el PC de destino, con acceso normal a npm, ejecutar obligatoriamente:

```powershell
npm ci
npm test
npm run test:reports
npm run test:persistence-concurrency
npm run test:resilience
```

Si `DATA_SOURCE=mysql`, aplicar antes la nueva migración:

```powershell
npm run db:migrate
npm run db:validate
```

## Alcance de HA

El software queda preparado para dos instancias Node compartiendo estado mediante MySQL y para ser colocado detrás de HAProxy/Nginx. La alta disponibilidad física completa exige infraestructura externa al ZIP: servidores/VM independientes, balanceador realmente instalado, MySQL InnoDB Cluster/Group Replication + MySQL Router y almacenamiento de respaldo independiente.
