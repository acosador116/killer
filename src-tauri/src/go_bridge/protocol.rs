//! Protocolo JSON-RPC line-delimited Go ↔ Rust
//!
//! Cada mensaje es una línea JSON. Este módulo define los structs
//! que se serializan a/desde el túnel stdio.
//!
//! Ejemplo de Request (Rust → Go):
//! ```json
//! {"id":"a1b2c3","method":"list_dir","params":{"path":"/src"}}
//! ```
//! Ejemplo de Response (Go → Rust):
//! ```json
//! {"id":"a1b2c3","result":{"type":"dir","path":"/src/..."},"error":null}
//! ```

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Request que Rust envía a Go por stdin.
#[derive(Debug, Serialize, Deserialize)]
pub struct GoRequest {
    pub id: String,
    pub method: String,
    pub params: Value,
}

/// Response que Go envía a Rust por stdout.
#[derive(Debug, Serialize, Deserialize)]
pub struct GoResponse {
    pub id: String,
    pub result: Option<Value>,
    pub error: Option<String>,
}

impl GoRequest {
    pub fn new(method: impl Into<String>, params: Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            method: method.into(),
            params,
        }
    }
}
