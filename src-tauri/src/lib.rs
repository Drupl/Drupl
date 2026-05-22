mod menu;
mod plugins;
mod pty;

use plugins::{
    plugin_list, plugin_load, plugin_transform, plugin_unload, PluginState,
};
use pty::{pty_kill, pty_resize, pty_spawn, pty_write, PtyState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PtyState::default())
        .manage(PluginState::default())
        .setup(|app| {
            menu::register(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            plugin_list,
            plugin_load,
            plugin_unload,
            plugin_transform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
