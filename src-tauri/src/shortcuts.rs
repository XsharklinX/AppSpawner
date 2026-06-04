// shortcuts.rs — Creación y eliminación de accesos directos en el SO.
// Windows  → PowerShell WScript.Shell (.lnk)
// macOS    → Bundle .app con script ejecutable
// Linux    → Archivo .desktop (freedesktop.org)

use std::fs;
use crate::store::AppConfig;

#[derive(Debug, serde::Serialize)]
pub struct ShortcutResult {
    pub success: bool,
    pub path:    Option<String>,
    pub error:   Option<String>,
}

/// Crea accesos directos en Desktop y/o Start Menu según settings.
pub fn create_shortcuts(
    app_config: &AppConfig,
    exec_path: &str,
    desktop: bool,
    start_menu: bool,
) -> Vec<ShortcutResult> {
    let mut results = vec![];
    if desktop   { results.push(create_shortcut(app_config, exec_path, ShortcutTarget::Desktop)); }
    if start_menu { results.push(create_shortcut(app_config, exec_path, ShortcutTarget::StartMenu)); }
    results
}

/// Elimina todos los accesos directos de una app.
pub fn remove_shortcuts(app_config: &AppConfig) {
    #[cfg(target_os = "windows")]
    {
        let desktop   = dirs::desktop_dir().unwrap_or_default().join(format!("{}.lnk", app_config.name));
        let startmenu = dirs::data_local_dir()
            .unwrap_or_default()
            .join("Microsoft/Windows/Start Menu/Programs")
            .join(format!("{}.lnk", app_config.name));
        for p in [desktop, startmenu] {
            if p.exists() { let _ = fs::remove_file(p); }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let desktop = dirs::desktop_dir().unwrap_or_default().join(format!("{}.app", app_config.name));
        let apps    = dirs::home_dir().unwrap_or_default().join("Applications").join(format!("{}.app", app_config.name));
        for p in [desktop, apps] {
            if p.exists() { let _ = fs::remove_dir_all(p); }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let desktop   = dirs::desktop_dir().unwrap_or_default().join(format!("appspawner-{}.desktop", app_config.id));
        let apps_menu = dirs::home_dir()
            .unwrap_or_default()
            .join(".local/share/applications")
            .join(format!("appspawner-{}.desktop", app_config.id));
        for p in [desktop, apps_menu] {
            if p.exists() { let _ = fs::remove_file(p); }
        }
    }
}

// ── Implementaciones por plataforma ──────────────────────────────────────────

#[allow(dead_code)]
enum ShortcutTarget { Desktop, StartMenu }

fn create_shortcut(app: &AppConfig, exec_path: &str, target: ShortcutTarget) -> ShortcutResult {
    #[cfg(target_os = "windows")]
    return create_windows_shortcut(app, exec_path, target);

    #[cfg(target_os = "macos")]
    return create_mac_shortcut(app, exec_path, target);

    #[cfg(target_os = "linux")]
    return create_linux_shortcut(app, exec_path, target);

    #[allow(unreachable_code)]
    ShortcutResult { success: false, path: None, error: Some("Plataforma no soportada".into()) }
}

// ── Windows ───────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn create_windows_shortcut(app: &AppConfig, exec_path: &str, target: ShortcutTarget) -> ShortcutResult {
    let target_dir = match target {
        ShortcutTarget::Desktop   => dirs::desktop_dir().unwrap_or_default(),
        ShortcutTarget::StartMenu => dirs::data_local_dir()
            .unwrap_or_default()
            .join("Microsoft\\Windows\\Start Menu\\Programs"),
    };

    if let Err(e) = fs::create_dir_all(&target_dir) {
        return ShortcutResult { success: false, path: None, error: Some(e.to_string()) };
    }

    let shortcut_path = target_dir.join(format!("{}.lnk", sanitize_filename(&app.name)));
    let args          = format!("--launch-app={}", app.id);

    // PowerShell está disponible en todas las versiones modernas de Windows
    let ps_script = format!(
        r#"$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('{}'); $sc.TargetPath = '{}'; $sc.Arguments = '{}'; $sc.Description = 'Abrir {} en AppSpawner'; $sc.Save()"#,
        shortcut_path.to_string_lossy().replace('\'', "''"),
        exec_path.replace('\'', "''"),
        args,
        app.name.replace('\'', "''"),
    );

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match output {
        Ok(o) if o.status.success() =>
            ShortcutResult { success: true, path: Some(shortcut_path.to_string_lossy().into()), error: None },
        Ok(o) =>
            ShortcutResult { success: false, path: None, error: Some(String::from_utf8_lossy(&o.stderr).into()) },
        Err(e) =>
            ShortcutResult { success: false, path: None, error: Some(e.to_string()) },
    }
}

#[cfg(target_os = "windows")]
trait CommandExt {
    fn creation_flags(&mut self, flags: u32) -> &mut Self;
}
#[cfg(target_os = "windows")]
impl CommandExt for std::process::Command {
    fn creation_flags(&mut self, flags: u32) -> &mut Self {
        std::os::windows::process::CommandExt::creation_flags(self, flags)
    }
}

// ── macOS ─────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn create_mac_shortcut(app: &AppConfig, exec_path: &str, target: ShortcutTarget) -> ShortcutResult {
    let target_dir = match target {
        ShortcutTarget::Desktop   => dirs::desktop_dir().unwrap_or_default(),
        ShortcutTarget::StartMenu => dirs::home_dir().unwrap_or_default().join("Applications"),
    };

    let bundle_path = target_dir.join(format!("{}.app", sanitize_filename(&app.name)));
    let macos_path  = bundle_path.join("Contents/MacOS");
    let _res_path   = bundle_path.join("Contents/Resources");

    if let Err(e) = fs::create_dir_all(&macos_path) {
        return ShortcutResult { success: false, path: None, error: Some(e.to_string()) };
    }

    let script_path = macos_path.join(&app.name);
    let script      = format!(
        "#!/bin/bash\nexec {:?} --launch-app={} \"$@\"\n",
        exec_path, app.id
    );

    if let Err(e) = fs::write(&script_path, script) {
        return ShortcutResult { success: false, path: None, error: Some(e.to_string()) };
    }

    // chmod +x
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(&script_path, fs::Permissions::from_mode(0o755));

    // Info.plist mínimo
    let plist = format!(
r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>{}</string>
  <key>CFBundleExecutable</key><string>{}</string>
  <key>CFBundleIdentifier</key><string>com.appspawner.app.{}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><false/>
</dict></plist>"#,
        app.name, app.name, app.id
    );
    let _ = fs::write(bundle_path.join("Contents/Info.plist"), plist);

    ShortcutResult { success: true, path: Some(bundle_path.to_string_lossy().into()), error: None }
}

// ── Linux ─────────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn create_linux_shortcut(app: &AppConfig, exec_path: &str, target: ShortcutTarget) -> ShortcutResult {
    let target_dir = match target {
        ShortcutTarget::Desktop   => dirs::desktop_dir().unwrap_or_default(),
        ShortcutTarget::StartMenu => dirs::home_dir()
            .unwrap_or_default()
            .join(".local/share/applications"),
    };

    if let Err(e) = fs::create_dir_all(&target_dir) {
        return ShortcutResult { success: false, path: None, error: Some(e.to_string()) };
    }

    let file_path = target_dir.join(format!("appspawner-{}.desktop", app.id));
    let content   = format!(
"[Desktop Entry]
Name={}
Comment=Abrir {} en AppSpawner
Exec={:?} --launch-app={}
Icon=appspawner
Terminal=false
Type=Application
Categories=Network;WebBrowser;
StartupWMClass=AppSpawner
",
        app.name, app.name, exec_path, app.id
    );

    if let Err(e) = fs::write(&file_path, content) {
        return ShortcutResult { success: false, path: None, error: Some(e.to_string()) };
    }

    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(&file_path, fs::Permissions::from_mode(0o755));

    ShortcutResult { success: true, path: Some(file_path.to_string_lossy().into()), error: None }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string()
}
