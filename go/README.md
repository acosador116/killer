# Killer Go — Sistema de Archivos Real

> **"El verdadero corazón"** del proyecto. Todo el acceso al filesystem vive aquí, en Go. Rust solo hace de túnel.

## Arquitectura General

```text
┌─────────────────┐  invoke("fs_*")   ┌──────────────────┐  stdin JSON line  ┌─────────────────┐
│  SolidJS (TS)   │ ─────────────────> │  Rust (Tauri)    │ ─────────────────> │  Go (fs.SVC)   │
│  src/services/  │ <───────────────── │  go_bridge/      │ <───────────────── │  internal/fs/  │
│  fsService.ts   │   JSON Response    │  sidecar.rs      │   stdout JSON       │  internal/ipc/ │
└─────────────────┘                    └──────────────────┘                    └─────────────────┘
 \_________________________________ TÚNEL IPC (stdio) _________________________________/
```

- **Go** no abre puertos. Es un *sidecar* hijo de Rust, habla solo por `stdin`/`stdout` con JSON por línea.
- **Rust** lo spawnea en `setup` y mantiene pipes abiertos. Cada comando Tauri hace `bridge.call()`.
- **Solid** usa `fsService` que hace `invoke()` a Rust; Rust proxy-a a Go.
- Si Go no está, Rust retorna error y el frontend hace fallback a `src/cache/file.ts` (mock).

---

## Estructura de carpetas

```
killer/go/
├── go.mod                 # module killer
├── main.go                # entrypoint: crea fs.Service + ipc.Server
├── README.md              # este archivo
└── internal/
    ├── fs/
    │   ├── types.go       # Directory, File, Stat — contrato JSON
    │   └── fs.go          # Service con ListDir, ReadFile, Tree, etc.
    └── ipc/
        ├── protocol.go    # Request/Response structs
        └── server.go      # Loop que lee stdin y escribe stdout
```

---

## `internal/fs/types.go` — Tipos Compartidos

Define el contrato JSON idéntico a `src/types/fs.ts`.

```go
// Ejemplo de uso:
import "killer/internal/fs"

type Directory struct {
    Type       string      `json:"type"`       // "dir"
    Path       string      `json:"path"`       // "/src/components/"
    Name       string      `json:"name"`       // "components"
    Directorys []Directory `json:"directorys"`
    Files      []FileDeck  `json:"files"`
}
```

JSON que produce `ListDir("/src")`:

```json
{
  "type": "dir",
  "path": "/src/",
  "name": "src",
  "directorys": [{ "type":"dir", "path":"/src/components/", "name":"components", "directorys":[], "files":[] }],
  "files": [{ "type":"file", "path":"/src/App.tsx", "name":"App.tsx" }]
}
```

---

## `internal/fs/fs.go` — Service

Service stateless, thread-safe. Usa solo `os` y `filepath`.

### ListDir

Lista **un nivel** de una carpeta.

```go
svc := fs.NewService()
dir, err := svc.ListDir("/home/user/docs")
// dir.Directorys = subcarpetas, dir.Files = archivos
```

Implementación clave:
- `os.ReadDir` + `sort` alfabético
- Detecta directorios vs archivos
- Normaliza paths a `filepath.ToSlash` para JSON consistente
- Retorna `Directory` con trailing slash en `Path` para dirs

### ReadFile

Lee contenido (límite 10 MB), detecta binarios.

```go
f, err := svc.ReadFile("/etc/hosts")
if f.IsBinary { /* mostrar placeholder */ }
fmt.Println(f.Data, *f.Extension) // "go"
```

- Usa `io.LimitReader` para evitar OOM
- `isBinary` detecta NUL bytes o utf8 inválido
- Si binario, `Data = "[binary file N bytes]"`

### Tree

Árbol recursivo con límite.

```go
tree, _ := svc.Tree(fs.TreeOptions{Root: ".", MaxDepth: 2, ShowHidden: false})
// tree.Directorys[0].Directorys ... 2 niveles
```

- Llama `ListDir` recursivo
- `MaxDepth 0` = infinito (¡cuidado!)
- Si un subdir no es accesible, lo saltea en vez de fallar todo

### Otros helpers

```go
svc.Stat("/src")        // metadata
svc.WriteFile("/tmp/x", "hola")
svc.Exists("/src")      // bool
svc.EnsureDir("/a/b/c") // mkdir -p
svc.Delete("/tmp/x")
svc.Walk("/src", func(path string, d fs.DirEntry) error { ... })
```

---

## `internal/ipc/protocol.go` — Protocolo

Cada línea stdin es un `Request`, cada línea stdout es un `Response`.

```go
type Request struct {
    ID     string          `json:"id"`
    Method string          `json:"method"` // "list_dir", "read_file", etc.
    Params json.RawMessage `json:"params"`
}

type Response struct {
    ID     string      `json:"id"`
    Result interface{} `json:"result,omitempty"`
    Error  *string     `json:"error"`
}
```

Params tipados:

```go
type ListDirParams struct { Path string `json:"path"` }
type ReadFileParams struct { Path string `json:"path"` }
type TreeParams struct { Root string `json:"root"`; MaxDepth int `json:"maxDepth"`; ShowHidden bool `json:"showHidden"` }
```

---

## `internal/ipc/server.go` — Túnel

Loop que lee `stdin` línea a línea y despacha.

```go
svc := fs.NewService()
srv := ipc.NewServer(svc, os.Stdin, os.Stdout)
srv.Run(context.Background()) // bloquea hasta EOF
```

- Usa `bufio.Scanner` con buffer 10 MB
- Loguea a `stderr` (no interfiere con túnel)
- `dispatch` mapea `method` → `fs.Service`
- `writeResponse` hace `json.Marshal` + `fmt.Fprintln(w, string(b))`

Métodos soportados:
- `ping` → `"pong"`
- `list_dir` → `Directory`
- `read_file` → `File`
- `stat` → `Stat`
- `tree` → `Directory` (árbol)
- `write_file`, `delete`, `exists`, `ensure_dir`

---

## `main.go` — Entrypoint

```go
svc := fs.NewService()
srv := ipc.NewServer(svc, os.Stdin, os.Stdout)
fmt.Fprintln(os.Stderr, "[go] killer-go sidecar starting... PID:", os.Getpid())
srv.Run(ctx) // hasta SIGTERM o EOF
```

### Cómo probarlo sin Rust

```bash
# Compilar
go build -o /tmp/killer-go ./go

# Ping
echo '{"id":"1","method":"ping","params":{}}' | /tmp/killer-go
# {"id":"1","result":"pong","error":null}

# Listar
echo '{"id":"2","method":"list_dir","params":{"path":"."}}' | /tmp/killer-go | jq

# Leer archivo
echo '{"id":"3","method":"read_file","params":{"path":"./go.mod"}}' | /tmp/killer-go | jq

# Árbol
echo '{"id":"4","method":"tree","params":{"root":".","maxDepth":2,"showHidden":false}}' | /tmp/killer-go | jq
```

---

## Integración con Rust

Rust spawnea este binario:

```rust
let mut child = Command::new("src-tauri/binaries/killer-go")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
```

Y mantiene el túnel:

```rust
// Rust -> Go
stdin.write_all(format!("{}\n", json!({ "id": id, "method": "list_dir", "params": {"path": "/src"}})).as_bytes()).await?;
// Go -> Rust
let line = stdout.read_line().await?;
let resp: GoResponse = serde_json::from_str(&line)?;
```

Ver `src-tauri/src/go_bridge/sidecar.rs` para implementación completa.

---

## Seguridad

- `cleanPath` valida paths vacíos y normaliza `..`
- `ReadFile` limita a 10 MB
- `ListDir` verifica `info.IsDir()`
- No se expone `ReadFileRaw` por IPC (solo string)

---

## Futuro

- Añadir `watch` con `fsnotify` para notificar cambios al frontend
- Añadir `search` con `Walk` + `grep`
- Añadir `mimetype` para binarios
