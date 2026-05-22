// Drupl WASM plugin host.
//
// Plugin ABI v0 — every plugin must export:
//   - memory                         (i32 linear memory)
//   - alloc(size: i32) -> i32        (reserve `size` bytes, return ptr)
//   - transform(ptr: i32, len: i32) -> i64
//                                    (high32 = output ptr, low32 = output len)
//
// Plugins live in process; they can read/write only their own memory.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use uuid::Uuid;
use wasmi::{Engine, Linker, Memory, Module, Store, TypedFunc};

const SAMPLE_UPPER: &[u8] = include_bytes!("../resources/upper.wasm");

struct LoadedPlugin {
    name: String,
    source: String,
    store: Store<()>,
    memory: Memory,
    alloc: TypedFunc<i32, i32>,
    transform: TypedFunc<(i32, i32), i64>,
}

#[derive(Default)]
pub struct PluginState {
    plugins: Mutex<HashMap<String, LoadedPlugin>>,
    seeded: Mutex<bool>,
}

#[derive(Serialize, Clone)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub source: String,
}

fn instantiate(name: &str, source: &str, wasm: &[u8]) -> Result<LoadedPlugin, String> {
    let engine = Engine::default();
    let module = Module::new(&engine, wasm).map_err(|e| e.to_string())?;
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let pre = linker
        .instantiate(&mut store, &module)
        .map_err(|e| e.to_string())?;
    let instance = pre.start(&mut store).map_err(|e| e.to_string())?;
    let memory = instance
        .get_memory(&store, "memory")
        .ok_or_else(|| "plugin missing exported `memory`".to_string())?;
    let alloc = instance
        .get_typed_func::<i32, i32>(&store, "alloc")
        .map_err(|e| format!("plugin missing `alloc`: {e}"))?;
    let transform = instance
        .get_typed_func::<(i32, i32), i64>(&store, "transform")
        .map_err(|e| format!("plugin missing `transform`: {e}"))?;
    Ok(LoadedPlugin {
        name: name.to_string(),
        source: source.to_string(),
        store,
        memory,
        alloc,
        transform,
    })
}

fn ensure_seeded(state: &State<'_, PluginState>) {
    let mut seeded = state.seeded.lock().unwrap();
    if *seeded {
        return;
    }
    *seeded = true;
    drop(seeded);
    match instantiate("upper", "bundled", SAMPLE_UPPER) {
        Ok(plugin) => {
            let id = Uuid::new_v4().to_string();
            state.plugins.lock().unwrap().insert(id, plugin);
        }
        Err(e) => eprintln!("[plugins] failed to load bundled upper.wasm: {e}"),
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn plugin_list(state: State<'_, PluginState>) -> Vec<PluginInfo> {
    ensure_seeded(&state);
    state
        .plugins
        .lock()
        .unwrap()
        .iter()
        .map(|(id, p)| PluginInfo {
            id: id.clone(),
            name: p.name.clone(),
            source: p.source.clone(),
        })
        .collect()
}

#[tauri::command(rename_all = "snake_case")]
pub fn plugin_load(
    state: State<'_, PluginState>,
    path: String,
) -> Result<PluginInfo, String> {
    ensure_seeded(&state);
    let wasm = std::fs::read(&path).map_err(|e| e.to_string())?;
    let name = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("plugin")
        .to_string();
    let plugin = instantiate(&name, &path, &wasm)?;
    let id = Uuid::new_v4().to_string();
    let info = PluginInfo {
        id: id.clone(),
        name: plugin.name.clone(),
        source: plugin.source.clone(),
    };
    state.plugins.lock().unwrap().insert(id, plugin);
    Ok(info)
}

#[tauri::command(rename_all = "snake_case")]
pub fn plugin_unload(state: State<'_, PluginState>, id: String) -> Result<(), String> {
    state.plugins.lock().unwrap().remove(&id);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn plugin_transform(
    state: State<'_, PluginState>,
    id: String,
    input: String,
) -> Result<String, String> {
    let mut plugins = state.plugins.lock().unwrap();
    let plugin = plugins
        .get_mut(&id)
        .ok_or_else(|| "plugin not found".to_string())?;

    let input_bytes = input.as_bytes();
    let input_len = input_bytes.len() as i32;

    let input_ptr = plugin
        .alloc
        .call(&mut plugin.store, input_len)
        .map_err(|e| format!("alloc failed: {e}"))?;

    plugin
        .memory
        .write(&mut plugin.store, input_ptr as usize, input_bytes)
        .map_err(|e| format!("memory write failed: {e}"))?;

    let packed = plugin
        .transform
        .call(&mut plugin.store, (input_ptr, input_len))
        .map_err(|e| format!("transform failed: {e}"))?;

    let out_ptr = (packed >> 32) as usize;
    let out_len = (packed & 0xFFFF_FFFF) as usize;

    let mut out = vec![0u8; out_len];
    plugin
        .memory
        .read(&plugin.store, out_ptr, &mut out)
        .map_err(|e| format!("memory read failed: {e}"))?;

    String::from_utf8(out).map_err(|e| e.to_string())
}
