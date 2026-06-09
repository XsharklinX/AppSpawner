# AppSpawner Roadmap

## Deuda tecnica: completar adaptacion a modo claro

Fase 1 (hecha en v3.4.x): se crearon los tokens adaptativos `fg` / `overlay` / `line`
en `tailwind.config.js` (respaldados por `--fg-rgb` / `--overlay-rgb` / `--line-rgb`
en `index.css`, distintos para `html.dark` y `html.light`) y se migraron las pantallas
de mayor trafico: `Dashboard.jsx`, `AppCard.jsx`, `Layout/Sidebar.jsx`.

Patron de migracion (repetir por archivo):
- `text-white/NN` -> `text-fg/NN`, `text-white/[0.0N]` -> `text-fg/[0.0N]`
- `bg-white/[0.0N]` -> `bg-overlay/[0.0N]`
- `border-white/[0.0N]` -> `border-line/[0.0N]`
- `placeholder-white/NN` -> `placeholder-fg/NN`, `divide-white/[..]` -> `divide-line/[..]`
- NO tocar `text-white` / `bg-white` / `ring-white` / `border-white` SIN slash de opacidad
  cuando esten sobre fondos de color fijo (botones violeta, badges rojos, logos con
  gradiente de acento) — esos deben permanecer blancos en ambos temas.
- Revisar caso a caso los `ring-white/NN` (anillos de seleccion): si el elemento vive
  sobre una superficie adaptativa (`bg-overlay`/`bg-surface-*`), migrar a `ring-fg/NN`;
  si vive sobre un color fijo, dejarlo en `white`.

Archivos pendientes de migrar (orden sugerido por uso/visibilidad):
`CreateApp.jsx`, `Settings/index.jsx`, `Settings/General.jsx`, `Settings/Security.jsx`,
`Settings/AdBlock.jsx`, `Settings/Backup.jsx`, `Settings/Storage.jsx`, `Settings/About.jsx`,
`Settings/LinkRules.jsx`, `Settings/Appearance.jsx`, `Profiles.jsx`, `Discover.jsx`,
`Onboarding.jsx`, `QuickLauncher.jsx`, `SecurityCenter.jsx`, `SessionSnapshots.jsx`,
`AppCredentials.jsx`, `AppScripts.jsx`, `Downloads.jsx`, `BrowsingHistory.jsx`,
`Layout/TitleBar.jsx`, `contexts/AppContext.jsx`, `contexts/ToastContext.jsx`,
`common/Modal.jsx`, `common/Tooltip.jsx`, `common/Menu.jsx`, `common/EmptyState.jsx`,
`common/Switch.jsx`, `common/ShortcutInput.jsx`, `common/AppIcon.jsx`.

Tras cada tanda de archivos: `npx vite build` + correr la app y alternar
Settings > Apariencia > tema "Light" vs "Dark" para QA visual antes de continuar.

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
