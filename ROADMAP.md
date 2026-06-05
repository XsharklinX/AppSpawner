# AppSpawner Roadmap

## Prioridad alta

- Adblock con listas remotas actualizables: EasyList, EasyPrivacy, uBlock filters, annoyances y listas regionales.
- Motor de reglas compatible con sintaxis ABP/uBO para bloquear por dominio, recurso, scriptlet y filtro cosmetico.
- Reinstalacion/actualizacion de accesos directos cuando cambia el icono, nombre o modo de una app.
- Panel de diagnostico por app: errores de carga, peticiones bloqueadas, cookies, permisos y storage.
- Mejorar ventanas SSB con titlebar propia opcional, toolbar nativa y estado claro de online/offline.

## Prioridad media

- Perfiles avanzados: orden de apertura, delay configurable, layouts de ventanas y grupos por workspace.
- Sincronizacion/exportacion completa: apps, perfiles, reglas adblock, temas, scripts y credenciales.
- Marketplace de presets para apps conocidas con icono, user-agent, toolbar y reglas recomendadas.
- Capturas/sesiones con restauracion mas completa: cookies, localStorage, sessionStorage y ventanas abiertas.
- Reglas de link routing por app: abrir externo, mantener dentro, abrir en otra SSB o preguntar.

## Pulido visual

- Sistema de iconos consistente para AppSpawner, tray, installer, accesos directos y ventanas SSB.
- Estados de controles mas claros: toggles, botones seleccionados, alerts y permisos.
- Tema custom con previsualizacion en vivo por secciones y export/import de paletas.
- Vista "Mis Apps" con lista compacta, grid, orden manual, tags y acciones bulk.

## Seguridad y privacidad

- Permisos por app: camara, microfono, ubicacion, notificaciones, descargas y clipboard.
- Modo privacidad extrema: bloqueo de fingerprinting, WebRTC IP leak, third-party cookies y referers.
- Sandbox de scripts de usuario con validacion, versionado y desactivacion rapida.
- Auditoria de dominios externos contactados por cada app.

## Build y distribucion

- Auto-update firmado.
- Builds separados por canal: stable, beta y nightly.
- Changelog generado desde commits o archivo de release.
- Tests automatizados del renderer y smoke test de Electron antes de empaquetar.
