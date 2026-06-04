// main.rs — Punto de entrada. Tauri requiere que main() esté en este archivo.
// La lógica real está en lib.rs para que la librería sea testeable.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run();
}
