mod commands;
mod shortcuts;
mod store;

use std::path::PathBuf;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use store::Store;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(id) = extract_launch_app_id(&argv) {
                let handle = app.clone();
                let _ = app.clone().run_on_main_thread(move || {
                    launch_app_by_id(&handle, &id);
                });
            } else if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_process::init())
        .manage(Store::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_apps,
            commands::install_app,
            commands::uninstall_app,
            commands::update_app,
            commands::toggle_pin,
            commands::mark_launched,
            commands::launch_app,
            commands::get_settings,
            commands::update_settings,
            commands::get_user,
            commands::save_user,
            commands::create_shortcuts,
            commands::remove_shortcuts,
            commands::get_storage_info,
            commands::clear_app_data,
            commands::get_default_install_path,
            commands::get_platform,
            commands::get_version,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
        ])
        .setup(|app| {
            // Tray
            if let Err(e) = build_tray(app.handle()) {
                eprintln!("Tray error (non-fatal): {e}");
            }

            // Si se lanzó con --launch-app, abrir la SSB; si no, la ventana principal ya está visible
            let argv: Vec<String> = std::env::args().collect();
            if let Some(id) = extract_launch_app_id(&argv) {
                let h = app.handle().clone();
                app.run_on_main_thread(move || {
                    launch_app_by_id(&h, &id);
                })?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error al ejecutar AppSpawner");
}

// ── Tray ──────────────────────────────────────────────────────────────────────

fn build_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let store = app.state::<Store>();
    let data  = store.read();

    let mut recent: Vec<_> = data.apps.iter()
        .filter(|a| a.last_used.is_some())
        .collect();
    recent.sort_by(|a, b| b.last_used.cmp(&a.last_used));
    recent.truncate(10);

    let menu = Menu::new(app)?;
    let open_item = MenuItem::with_id(app, "open_dashboard", "Abrir AppSpawner", true, None::<&str>)?;
    menu.append(&open_item)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;

    for app_conf in &recent {
        let item = MenuItem::with_id(
            app,
            format!("launch_{}", app_conf.id),
            format!("▶  {}", app_conf.name),
            true,
            None::<&str>,
        )?;
        menu.append(&item)?;
    }

    if !recent.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    menu.append(&quit_item)?;

    let icon = app.default_window_icon()
        .cloned()
        .ok_or("No icon")?;

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("AppSpawner")
        .menu(&menu)
        .on_menu_event({
            let h = app.clone();
            move |_tray, event| handle_tray_menu(&h, event.id().as_ref())
        })
        .on_tray_icon_event({
            let h = app.clone();
            move |_tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up, ..
                } = event {
                    toggle_main_window(&h);
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "open_dashboard" => toggle_main_window(app),
        "quit" => app.exit(0),
        id if id.starts_with("launch_") => {
            launch_app_by_id(app, id.trim_start_matches("launch_"));
        }
        _ => {}
    }
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

// ── SSB launch ────────────────────────────────────────────────────────────────

fn launch_app_by_id(app: &AppHandle, id: &str) {
    let store = app.state::<Store>();
    let data  = store.read();

    let Some(cfg) = data.apps.iter().find(|a| a.id == id).cloned() else {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
        }
        return;
    };

    let label = format!("ssb_{}", cfg.id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let sessions_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("AppSpawner")
        .join("sessions");

    let Ok(url) = cfg.url.parse() else { return };

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(&cfg.name)
        .inner_size(cfg.window_config.width as f64, cfg.window_config.height as f64)
        .min_inner_size(400.0, 300.0)
        .data_directory(sessions_dir.join(format!("app_{}", cfg.id)))
        .initialization_script(commands::SSB_INIT_SCRIPT)
        .zoom_hotkeys_enabled(true)
        .on_navigation(|_| true);

    if !cfg.user_agent.is_empty() {
        builder = builder.user_agent(&cfg.user_agent);
    }

    if builder.build().is_ok() {
        let _ = store.mutate(|d| {
            if let Some(a) = d.apps.iter_mut().find(|a| a.id == cfg.id) {
                a.last_used = Some(store::now_ms());
            }
        });
    }
}

fn extract_launch_app_id(argv: &[String]) -> Option<String> {
    argv.iter()
        .find(|a| a.starts_with("--launch-app="))
        .map(|a| a.trim_start_matches("--launch-app=").trim().to_string())
        .filter(|s| !s.is_empty())
}
