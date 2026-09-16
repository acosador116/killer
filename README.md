# Killer — Tauri + Solid + Go (Filesystem Real)

> Template original: Tauri + Solid + Typescript. Ahora con **Go como corazón del filesystem** y **Rust como túnel IPC**.

## Arquitectura

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para diagrama completo y [`go/README.md`](./go/README.md) para el FS en Go.

```
SolidJS  --invoke-->  Rust (Tauri go_bridge)  --stdio JSON-->  Go (internal/fs)
```

## Inicio Rápido

### 1. Solo Web (mock, sin Go)

```bash
cd killer
pnpm install
pnpm dev        # http://localhost:1420 — usa src/cache/file.ts mock
```

### 2. Con Go + Rust (filesystem real)

```bash
# Compilar Go sidecar
cd killer/go
go vet ./... && go build -o ../src-tauri/binaries/killer-go .

# Copiar con triple para Tauri
cp ../src-tauri/binaries/killer-go ../src-tauri/binaries/killer-go-x86_64-unknown-linux-gnu

# Correr Tauri (spawnea Go automáticamente)
cd ..
pnpm tauri dev
```

O dejar que `cargo build` lo haga solo (ver `src-tauri/build.rs`):

```bash
cargo run --manifest-path src-tauri/Cargo.toml
```

### 3. Probar Go sin Rust

```bash
go build -o /tmp/killer-go ./go

echo '{"id":"1","method":"ping","params":{}}' | /tmp/killer-go
# {"id":"1","result":"pong","error":null}

echo '{"id":"2","method":"list_dir","params":{"path":"."}}' | /tmp/killer-go | jq
echo '{"id":"3","method":"tree","params":{"root":".","maxDepth":2,"showHidden":false}}' | /tmp/killer-go | jq
```

## Estructura

```
killer/
├── go/                         # Corazón Go
│   ├── main.go                 # entrypoint IPC
│   ├── internal/fs/            # filesystem real
│   └── internal/ipc/           # protocolo JSON line-delimited
├── src-tauri/
│   ├── src/go_bridge/          # Rust que corre Go y expone Tauri commands
│   └── build.rs                # compila Go automáticamente
└── src/
    ├── types/fs.ts             # Tipos canónicos (contrato Go↔JS)
    ├── services/fsService.ts   # Cliente invoke → Rust → Go
    ├── services/fileService.ts # Híbrido real/mock
    ├── cache/file.ts           # Mock web
    └── cache/fsCache.ts        # Cache reactivo real
```

## Comandos Tauri (JS → Rust → Go)

```ts
import { invoke } from "@tauri-apps/api/core"

await invoke("fs_ping")
await invoke("fs_list_dir", { path: "/src" })
await invoke("fs_read_file", { path: "/src/App.tsx" })
await invoke("fs_tree", { root: ".", maxDepth: 2, showHidden: false })
await invoke("fs_stat", { path: "/src" })
await invoke("fs_write_file", { path: "/tmp/x", data: "hola" })
```

Ver `src/services/fsService.ts` para wrapper con fallback.

## Desarrollo Web vs Tauri

- **Web (`vite dev`)**: `fsService.isAvailable()` → `false` → usa `archs` mock. Ideal para UI rápido.
- **Tauri (`tauri dev`)**: `fsService.isAvailable()` → `true` → usa Go real. `fsCache.init()` carga árbol real.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Go](https://go.dev/) 1.22+
