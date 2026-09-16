package ipc

// Package ipc — protocolo JSON-RPC line-delimited entre Rust ↔ Go.
//
// Cada mensaje es UNA línea JSON terminada en `\n` sobre stdin/stdout.
// stderr se reserva para logs humanos (no interfiere con el túnel).
//
// Flow:
//   Rust --(stdin)-->  {"id":"1","method":"list_dir","params":{"path":"/src"}}
//   Go   --(stdout)--> {"id":"1","result":{...},"error":null}
//
// Rust spawnea el binario Go como `sidecar` y mantiene dos pipes.
// Tauri expone `invoke("fs_list_dir", {path})` que internamente
// hace `sidecar.request("list_dir", params)` y espera la respuesta.
//
// Ejemplo en Rust (pseudo):
//
// ```rust
// let resp: Directory = sidecar.call("list_dir", json!({"path": "/src"})).await?;
// ```
//
// Ejemplo manual desde terminal:
//
// ```bash
// echo '{"id":"1","method":"ping","params":{}}' | ./killer-go
// # {"id":"1","result":"pong","error":null}
// echo '{"id":"2","method":"list_dir","params":{"path":"."}}' | ./killer-go
// ```

import (
	"encoding/json"
)

// Request es lo que envía Rust a Go por stdin.
type Request struct {
	ID     string          `json:"id"`     // correlation id (uuid o contador)
	Method string          `json:"method"` // ej: "list_dir", "read_file"
	Params json.RawMessage `json:"params"` // objeto libre según método
}

// Response es lo que responde Go por stdout.
type Response struct {
	ID     string      `json:"id"`
	Result interface{} `json:"result,omitempty"`
	Error  *string     `json:"error"` // null si ok, string si falló
}

// Params tipados para cada método — así evitamos `map[string]any` suelto.

type ListDirParams struct {
	Path string `json:"path"`
}

type ReadFileParams struct {
	Path string `json:"path"`
}

type StatParams struct {
	Path string `json:"path"`
}

type TreeParams struct {
	Root       string `json:"root"`
	MaxDepth   int    `json:"maxDepth"`
	ShowHidden bool   `json:"showHidden"`
}

type WriteFileParams struct {
	Path string `json:"path"`
	Data string `json:"data"`
}

type DeleteParams struct {
	Path string `json:"path"`
}

type ExistsParams struct {
	Path string `json:"path"`
}

type EnsureDirParams struct {
	Path string `json:"path"`
}

// Helpers para construir respuestas

func okResponse(id string, result interface{}) Response {
	return Response{ID: id, Result: result, Error: nil}
}

func errResponse(id string, msg string) Response {
	return Response{ID: id, Result: nil, Error: &msg}
}

// mustMarshal ignora error porque controlamos el tipo
func mustMarshal(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
