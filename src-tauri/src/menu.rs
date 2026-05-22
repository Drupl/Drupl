use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Wry};

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    // App menu (Drupl) — macOS conventions
    let about = PredefinedMenuItem::about(app, Some("About Drupl"), None)?;
    let services = PredefinedMenuItem::services(app, None)?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let app_menu = SubmenuBuilder::new(app, "Drupl")
        .item(&about)
        .separator()
        .item(&services)
        .separator()
        .item(&hide)
        .item(&hide_others)
        .item(&show_all)
        .separator()
        .item(&quit)
        .build()?;

    // File menu
    let new_file = MenuItemBuilder::with_id("new_file", "New File")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let new_project = MenuItemBuilder::with_id("new_project", "New Project")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let open_file = MenuItemBuilder::with_id("open_file", "Open File…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder…")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save_as", "Save As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let close_window = PredefinedMenuItem::close_window(app, None)?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_file)
        .item(&new_project)
        .separator()
        .item(&open_file)
        .item(&open_folder)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&close_window)
        .build()?;

    // Edit menu
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&undo)
        .item(&redo)
        .separator()
        .item(&cut)
        .item(&copy)
        .item(&paste)
        .separator()
        .item(&select_all)
        .build()?;

    // View menu
    let command_palette = MenuItemBuilder::with_id("command_palette", "Command Palette…")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let toggle_terminal = MenuItemBuilder::with_id("toggle_terminal", "Toggle Terminal")
        .accelerator("CmdOrCtrl+`")
        .build(app)?;
    let split_right = MenuItemBuilder::with_id("split_right", "Split Right")
        .accelerator("CmdOrCtrl+\\")
        .build(app)?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&command_palette)
        .separator()
        .item(&split_right)
        .item(&toggle_terminal)
        .build()?;

    // Window menu
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let maximize = PredefinedMenuItem::maximize(app, None)?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&minimize)
        .item(&maximize)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

pub fn register(app: &AppHandle) -> tauri::Result<()> {
    let menu = build(app)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let id = event.id().0.as_str().to_string();
        let _ = app.emit("menu", id);
    });
    Ok(())
}
