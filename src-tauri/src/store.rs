// store.rs — Persistencia de datos en JSON local.
// Escritura atómica: temp file + rename para evitar corrupción.

use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use serde::{Deserialize, Serialize};
use dirs::data_local_dir;

// ── Modelos de datos ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub width:  u32,
    pub height: u32,
}

impl Default for WindowConfig {
    fn default() -> Self { Self { width: 1280, height: 800 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub id:            String,
    pub name:          String,
    pub url:           String,
    pub category:      String,
    pub icon_type:     String,
    pub icon_value:    String,
    pub icon_color:    String,
    pub user_agent:    String,
    pub window_config: WindowConfig,
    pub catalog_id:    Option<String>,
    pub pinned:        bool,
    pub last_used:     Option<u64>,
    pub installed_at:  u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme:               String,
    pub language:            String,
    pub desktop_shortcuts:   bool,
    pub start_menu_shortcuts: bool,
    pub install_path:        String,
    pub intercept_links:     bool,
    pub force_browser:       bool,
    pub auto_launch:         bool,
    pub custom_user_agent:   String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme:               "dark".into(),
            language:            "es".into(),
            desktop_shortcuts:   true,
            start_menu_shortcuts: true,
            install_path:        String::new(),
            intercept_links:     false,
            force_browser:       false,
            auto_launch:         false,
            custom_user_agent:   String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub name:         String,
    pub install_path: String,
    pub created_at:   u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoreData {
    pub user:     Option<User>,
    pub settings: Settings,
    pub apps:     Vec<AppConfig>,
}

// ── Store con Mutex para thread-safety ───────────────────────────────────────

pub struct Store {
    pub path:    PathBuf,
    pub backup:  PathBuf,
    pub data:    Mutex<StoreData>,
}

impl Store {
    /// Construye el store y carga los datos desde disco.
    pub fn new() -> Self {
        let base   = data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("AppSpawner");
        fs::create_dir_all(&base).ok();

        let path   = base.join("appspawner-data.json");
        let backup = base.join("appspawner-data.bak.json");
        let data   = load_data(&path, &backup);

        Self { path, backup, data: Mutex::new(data) }
    }

    /// Lee una copia del estado actual.
    pub fn read(&self) -> StoreData {
        self.data.lock().unwrap().clone()
    }

    /// Aplica una mutación y persiste atómicamente.
    pub fn mutate<F>(&self, f: F) -> Result<(), String>
    where F: FnOnce(&mut StoreData)
    {
        let mut guard = self.data.lock().unwrap();
        f(&mut guard);
        write_atomic(&self.path, &self.backup, &*guard)
    }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

fn load_data(path: &Path, backup: &Path) -> StoreData {
    for file in [path, backup] {
        if let Ok(raw) = fs::read_to_string(file) {
            if let Ok(data) = serde_json::from_str::<StoreData>(&raw) {
                return data;
            }
        }
    }
    StoreData::default()
}

/// Escritura atómica: escribir a temp → backup del actual → rename.
fn write_atomic(path: &Path, backup: &Path, data: &StoreData) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| e.to_string())?;

    // Archivo temporal en el mismo directorio
    let temp = path.with_extension("tmp.json");

    // 1. Escribir temp
    let mut f = fs::File::create(&temp).map_err(|e| e.to_string())?;
    f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    f.flush().map_err(|e| e.to_string())?;
    drop(f);

    // 2. Backup del actual
    if path.exists() { fs::copy(path, backup).ok(); }

    // 3. Rename atómico
    fs::rename(&temp, path).map_err(|e| e.to_string())
}

/// Timestamp Unix en milisegundos.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
