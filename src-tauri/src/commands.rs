// commands.rs — Todos los comandos Tauri (equivalentes a ipcMain.handle de Electron).

use std::path::PathBuf;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::store::{AppConfig, Settings, Store, User, WindowConfig, now_ms};
use crate::shortcuts;

// ── Payload de instalación ────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInstallConfig {
    pub name:          String,
    pub url:           String,
    pub category:      String,
    pub icon_type:     String,
    pub icon_value:    String,
    pub icon_color:    String,
    pub user_agent:    String,
    pub window_config: Option<WindowConfig>,
    pub catalog_id:    Option<String>,
}

// ── Apps ──────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_apps(store: State<'_, Store>) -> Result<Vec<AppConfig>, String> {
    Ok(store.read().apps)
}

#[tauri::command]
pub async fn install_app(
    config: AppInstallConfig,
    store: State<'_, Store>,
) -> Result<AppConfig, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let window_config = config.window_config.unwrap_or_default();
    let clamped_w = window_config.width.clamp(400, 3840);
    let clamped_h = window_config.height.clamp(300, 2160);

    let app = AppConfig {
        id:           id.clone(),
        name:         config.name.trim().to_string(),
        url:          sanitize_url(&config.url)?,
        category:     config.category,
        icon_type:    config.icon_type,
        icon_value:   config.icon_value,
        icon_color:   config.icon_color,
        user_agent:   config.user_agent,
        window_config: WindowConfig { width: clamped_w, height: clamped_h },
        catalog_id:   config.catalog_id,
        pinned:       false,
        last_used:    None,
        installed_at: now_ms(),
    };

    store.mutate(|d| d.apps.push(app.clone()))?;
    Ok(app)
}

#[tauri::command]
pub async fn uninstall_app(id: String, store: State<'_, Store>) -> Result<(), String> {
    store.mutate(|d| d.apps.retain(|a| a.id != id))?;
    // Limpieza de datos de sesión: se borra la carpeta de datos del WebView
    Ok(())
}

#[tauri::command]
pub async fn update_app(
    id: String,
    updates: serde_json::Value,
    store: State<'_, Store>,
) -> Result<AppConfig, String> {
    let mut updated = None;
    store.mutate(|d| {
        if let Some(app) = d.apps.iter_mut().find(|a| a.id == id) {
            if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
                app.name = name.trim().to_string();
            }
            if let Some(url) = updates.get("url").and_then(|v| v.as_str()) {
                if let Ok(clean) = sanitize_url(url) { app.url = clean; }
            }
            if let Some(cat) = updates.get("category").and_then(|v| v.as_str()) {
                app.category = cat.to_string();
            }
            if let Some(ua) = updates.get("userAgent").and_then(|v| v.as_str()) {
                app.user_agent = ua.to_string();
            }
            if let Some(it) = updates.get("iconType").and_then(|v| v.as_str()) {
                app.icon_type = it.to_string();
            }
            if let Some(iv) = updates.get("iconValue").and_then(|v| v.as_str()) {
                app.icon_value = iv.to_string();
            }
            if let Some(ic) = updates.get("iconColor").and_then(|v| v.as_str()) {
                app.icon_color = ic.to_string();
            }
            updated = Some(app.clone());
        }
    })?;
    updated.ok_or_else(|| format!("App {} no encontrada", id))
}

#[tauri::command]
pub async fn toggle_pin(id: String, store: State<'_, Store>) -> Result<bool, String> {
    let mut pinned = false;
    store.mutate(|d| {
        if let Some(app) = d.apps.iter_mut().find(|a| a.id == id) {
            app.pinned = !app.pinned;
            pinned = app.pinned;
        }
    })?;
    Ok(pinned)
}

#[tauri::command]
pub async fn mark_launched(id: String, store: State<'_, Store>) -> Result<(), String> {
    store.mutate(|d| {
        if let Some(app) = d.apps.iter_mut().find(|a| a.id == id) {
            app.last_used = Some(now_ms());
        }
    })
}

// ── SSB Window ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn launch_app(id: String, store: State<'_, Store>, app: AppHandle) -> Result<(), String> {
    let data = store.read();
    let app_config = data.apps.iter().find(|a| a.id == id)
        .ok_or_else(|| format!("App {} no encontrada", id))?
        .clone();

    let label = format!("ssb_{}", app_config.id);

    // Si ya existe la ventana, enfócarla en lugar de crear otra
    if let Some(win) = app.get_webview_window(&label) {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let sessions_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("AppSpawner")
        .join("sessions");

    let url = WebviewUrl::External(app_config.url.parse().map_err(|e: url::ParseError| e.to_string())?);

    let mut builder = WebviewWindowBuilder::new(&app, &label, url)
        .title(&app_config.name)
        .inner_size(app_config.window_config.width as f64, app_config.window_config.height as f64)
        .min_inner_size(400.0, 300.0)
        .data_directory(sessions_dir.join(format!("app_{}", app_config.id)))
        .initialization_script(SSB_INIT_SCRIPT)
        .zoom_hotkeys_enabled(true)
        .on_navigation(|_url| true); // Permitir toda navegación dentro de la ventana SSB

    if !app_config.user_agent.is_empty() {
        builder = builder.user_agent(&app_config.user_agent);
    }

    builder.build().map_err(|e| e.to_string())?;

    // Actualizar lastUsed
    store.mutate(|d| {
        if let Some(a) = d.apps.iter_mut().find(|a| a.id == id) {
            a.last_used = Some(now_ms());
        }
    })?;

    Ok(())
}

pub const SSB_INIT_SCRIPT: &str = r#"
(function() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) { window.location.reload(); }
    if (e.altKey && e.key === 'ArrowLeft')  { window.history.back(); }
    if (e.altKey && e.key === 'ArrowRight') { window.history.forward(); }
  }, true);
})();
"#;

// ── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_settings(store: State<'_, Store>) -> Result<Settings, String> {
    Ok(store.read().settings)
}

#[tauri::command]
pub async fn update_settings(
    settings: Settings,
    store: State<'_, Store>,
) -> Result<Settings, String> {
    store.mutate(|d| d.settings = settings.clone())?;
    Ok(settings)
}

// ── User ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_user(store: State<'_, Store>) -> Result<Option<User>, String> {
    Ok(store.read().user)
}

#[tauri::command]
pub async fn save_user(user: User, store: State<'_, Store>) -> Result<User, String> {
    store.mutate(|d| d.user = Some(user.clone()))?;
    Ok(user)
}

// ── Shortcuts ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_shortcuts(
    id: String,
    store: State<'_, Store>,
    _app: AppHandle,
) -> Result<Vec<shortcuts::ShortcutResult>, String> {
    let data = store.read();
    let app_config = data.apps.iter().find(|a| a.id == id)
        .ok_or_else(|| format!("App {} no encontrada", id))?
        .clone();
    let settings = data.settings.clone();

    let exec_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let results = shortcuts::create_shortcuts(
        &app_config,
        &exec_path,
        settings.desktop_shortcuts,
        settings.start_menu_shortcuts,
    );
    Ok(results)
}

#[tauri::command]
pub async fn remove_shortcuts(id: String, store: State<'_, Store>) -> Result<(), String> {
    let data = store.read();
    if let Some(app_config) = data.apps.iter().find(|a| a.id == id) {
        shortcuts::remove_shortcuts(app_config);
    }
    Ok(())
}

// ── Storage / Info ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_storage_info(store: State<'_, Store>) -> Result<serde_json::Value, String> {
    let data = store.read();
    let sessions_dir = dirs::data_local_dir()
        .unwrap_or_default()
        .join("AppSpawner")
        .join("sessions");

    // Calcular tamaño de sesión por app
    let apps_with_storage: Vec<serde_json::Value> = data.apps.iter().map(|app| {
        let app_session_dir = sessions_dir.join(format!("app_{}", app.id));
        let storage_bytes = dir_size(&app_session_dir);
        serde_json::json!({
            "id":         app.id,
            "name":       app.name,
            "url":        app.url,
            "iconType":   app.icon_type,
            "iconValue":  app.icon_value,
            "iconColor":  app.icon_color,
            "storageBytes": storage_bytes,
        })
    }).collect();

    Ok(serde_json::json!({
        "apps":     apps_with_storage,
        "storePath": store.path.to_string_lossy(),
    }))
}

#[tauri::command]
pub async fn clear_app_data(id: String) -> Result<(), String> {
    let sessions_dir = dirs::data_local_dir()
        .unwrap_or_default()
        .join("AppSpawner")
        .join("sessions")
        .join(format!("app_{}", id));

    if sessions_dir.exists() {
        std::fs::remove_dir_all(&sessions_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Filesystem helpers ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_default_install_path() -> Result<String, String> {
    Ok(dirs::data_local_dir()
        .unwrap_or_default()
        .join("AppSpawner")
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub async fn get_platform() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

#[tauri::command]
pub async fn get_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn sanitize_url(raw: &str) -> Result<String, String> {
    let mut url = raw.trim().to_string();
    if !url.starts_with("http://") && !url.starts_with("https://") {
        url = format!("https://{}", url);
    }
    let parsed: url::Url = url.parse().map_err(|_| "URL inválida".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Solo se permiten URLs http/https".into());
    }
    Ok(parsed.to_string())
}

// ── Window control ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn minimize_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("Ventana no encontrada".to_string())?
        .minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn maximize_window(app: AppHandle) -> Result<(), String> {
    let win = app.get_webview_window("main")
        .ok_or("Ventana no encontrada".to_string())?;
    if win.is_maximized().unwrap_or(false) {
        win.unmaximize().map_err(|e| e.to_string())
    } else {
        win.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("Ventana no encontrada".to_string())?
        .hide().map_err(|e| e.to_string()) // Ocultar en lugar de cerrar (sigue en tray)
}

fn dir_size(path: &std::path::Path) -> u64 {
    if !path.is_dir() { return 0; }
    std::fs::read_dir(path).ok()
        .map(|entries| {
            entries.filter_map(|e| e.ok())
                .map(|e| {
                    let meta = e.metadata().ok();
                    if e.path().is_dir() {
                        dir_size(&e.path())
                    } else {
                        meta.map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}
