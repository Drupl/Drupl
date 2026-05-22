use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

#[derive(Serialize, Clone)]
struct PtyDataEvent {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Serialize, Clone)]
struct PtyExitEvent {
    session_id: String,
}

fn default_shell() -> String {
    if let Ok(sh) = std::env::var("SHELL") {
        if !sh.is_empty() {
            return sh;
        }
    }
    if cfg!(target_os = "windows") {
        "cmd.exe".to_string()
    } else if cfg!(target_os = "macos") {
        "/bin/zsh".to_string()
    } else {
        "/bin/bash".to_string()
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    session_id: String,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    eprintln!("[pty] spawn requested sid={session_id} cwd={:?} {}x{}", cwd, cols.unwrap_or(80), rows.unwrap_or(24));
    let pty_system = native_pty_system();
    let size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system.openpty(size).map_err(|e| {
        eprintln!("[pty] openpty failed: {e}");
        e.to_string()
    })?;
    eprintln!("[pty] openpty ok");

    let shell = default_shell();
    eprintln!("[pty] shell = {shell}");
    let mut cmd = CommandBuilder::new(&shell);
    if let Some(dir) = cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    } else if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair.slave.spawn_command(cmd).map_err(|e| {
        eprintln!("[pty] spawn_command failed: {e}");
        e.to_string()
    })?;
    eprintln!("[pty] spawn_command ok");
    drop(pair.slave);
    eprintln!("[pty] dropped slave");

    let writer = pair.master.take_writer().map_err(|e| {
        eprintln!("[pty] take_writer failed: {e}");
        e.to_string()
    })?;
    eprintln!("[pty] take_writer ok");
    let mut reader = pair.master.try_clone_reader().map_err(|e| {
        eprintln!("[pty] try_clone_reader failed: {e}");
        e.to_string()
    })?;
    eprintln!("[pty] try_clone_reader ok");

    state.sessions.lock().unwrap().insert(
        session_id.clone(),
        Session {
            master: pair.master,
            writer,
            child,
        },
    );
    eprintln!("[pty] session inserted");

    let sid = session_id.clone();
    let app_handle = app.clone();
    let sessions_arc = state.sessions.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let _ = app_handle.emit(
                        "pty-data",
                        PtyDataEvent {
                            session_id: sid.clone(),
                            data: buf[..n].to_vec(),
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit(
            "pty-exit",
            PtyExitEvent {
                session_id: sid.clone(),
            },
        );
        sessions_arc.lock().unwrap().remove(&sid);
    });
    eprintln!("[pty] reader thread spawned, returning ok");

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn pty_write(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn pty_resize(
    state: State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "session not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn pty_kill(state: State<'_, PtyState>, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}
