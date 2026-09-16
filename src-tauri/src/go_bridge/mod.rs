//! Go Bridge — módulo que conecta Rust (Tauri) con Go (filesystem)
//!
//! Estructura:
//! ```text
//! src-tauri/src/go_bridge/
//!   mod.rs       <- re-exports + setup helper
//!   protocol.rs  <- Request/Response structs
//!   sidecar.rs   <- spawns Go binary, mantiene túnel stdio
//! ```
//!
//! Uso en `lib.rs`:
//! ```rust
//! mod go_bridge;
//! use go_bridge::{GoBridge, register_commands};
//!
//! #[cfg_attr(mobile, tauri::mobile_entry_point)]
//! pub fn run() {
//!     tauri::Builder::default()
//!         .setup(|app| {
//!             let bridge = tauri::async_runtime::block_on(GoBridge::new());
//!             app.manage(bridge);
//!             Ok(())
//!         })
//!         .invoke_handler(tauri::generate_handler![
//!             greet,
//!             go_bridge::fs_ping,
//!             go_bridge::fs_list_dir,
//!             go_bridge::fs_read_file,
//!             go_bridge::fs_stat,
//!             go_bridge::fs_tree,
//!             go_bridge::fs_write_file,
//!             go_bridge::fs_delete,
//!             go_bridge::fs_exists,
//!             go_bridge::fs_ensure_dir,
//!         ])
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri");
//! }
//! ```

pub mod protocol;
pub mod sidecar;

pub use sidecar::GoBridge;

use tauri::State;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Tauri commands — cada uno es un proxy delgado hacia Go vía `bridge.call()`
// ---------------------------------------------------------------------------

/// Verifica que el túnel Rust↔Go esté vivo.
///
/// JS:
/// ```ts
/// import { invoke } from "@tauri-apps/api/core"
/// await invoke("fs_ping") // -> "pong"
/// ```
#[tauri::command]
pub async fn fs_ping(bridge: State<'_, GoBridge>) -> Result<String, String> {
    let v = bridge.call("ping", serde_json::json!({})).await?;
    // Go responde con `"pong"` como Value::String
    if let Some(s) = v.as_str() {
        Ok(s.to_string())
    } else {
        Ok(v.to_string())
    }
}

/// Lista un directorio (un nivel).
///
/// JS:
/// ```ts
/// const dir: Directory = await invoke("fs_list_dir", { path: "/src" })
/// ```
#[tauri::command]
pub async fn fs_list_dir(bridge: State<'_, GoBridge>, path: String) -> Result<Value, String> {
    bridge.call("list_dir", serde_json::json!({ "path": path })).await
}

/// Lee el contenido de un archivo (máx 10 MB).
///
/// JS:
/// ```ts
/// const file: Fille = await invoke("fs_read_file", { path: "/src/App.tsx" })
/// console.log(file.data)
/// ```
#[tauri::command]
pub async fn fs_read_file(bridge: State<'_, GoBridge>, path: String) -> Result<Value, String> {
    bridge.call("read_file", serde_json::json!({ "path": path })).await
}

/// Stat de un path (archivo o directorio).
#[tauri::command]
pub async fn fs_stat(bridge: State<'_, GoBridge>, path: String) -> Result<Value, String> {
    bridge.call("stat", serde_json::json!({ "path": path })).await
}

/// Árbol recursivo con límite de profundidad.
///
/// JS:
/// ```ts
/// const tree = await invoke("fs_tree", { root: ".", maxDepth: 2, showHidden: false })
/// ```
#[tauri::command]
pub async fn fs_tree(
    bridge: State<'_, GoBridge>,
    root: String,
    maxDepth: i32,
    showHidden: bool,
) -> Result<Value, String> {
    bridge
        .call(
            "tree",
            serde_json::json!({ "root": root, "maxDepth": maxDepth, "showHidden": showHidden }),
        )
        .await
}

/// Escribe (crea o trunca) un archivo.
///
/// JS:
/// ```ts
/// await invoke("fs_write_file", { path: "/tmp/hello.txt", data: "hola" })
/// ```
#[tauri::command]
pub async fn fs_write_file(bridge: State<'_, GoBridge>, path: String, data: String) -> Result<Value, String> {
    bridge
        .call("write_file", serde_json::json!({ "path": path, "data": data }))
        .await
}

/// Borra archivo o directorio recursivo.
#[tauri::command]
pub async fn fs_delete(bridge: State<'_, GoBridge>, path: String) -> Result<Value, String> {
    bridge.call("delete", serde_json::json!({ "path": path })).await
}

/// Verifica existencia.
#[tauri::command]
pub async fn fs_exists(bridge: State<'_, GoBridge>, path: String) -> Result<bool, String> {
    let v = bridge.call("exists", serde_json::json!({ "path": path })).await?;
    // Go responde {"exists": true}
    if let Some(obj) = v.as_object() {
        if let Some(b) = obj.get("exists").and_then(|x| x.as_bool()) {
            return Ok(b);
        }
    }
    // Fallback si Go respondió directamente bool
    if let Some(b) = v.as_bool() {
        return Ok(b);
    }
    Err(format!("unexpected exists response: {}", v))
}

/// Crea directorio con `mkdir -p`.
#[tauri::command]
pub async fn fs_ensure_dir(bridge: State<'_, GoBridge>, path: String) -> Result<Value, String> {
    bridge
        .call("ensure_dir", serde_json::json!({ "path": path }))
        .await
}
