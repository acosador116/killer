package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"killer/internal/fs"
	"killer/internal/ipc"
)

// Killer Go — Sidecar del sistema de archivos
//
// Este binario es el "verdadero corazón" que mencionabas.
// No abre puertos ni ventanas: vive como hijo de Rust (Tauri)
// y habla SOLO por stdio JSON line-delimited.
//
// # Cómo lo corre Rust (túnel IPC)
//
// ```rust
// // src-tauri/src/go_bridge/sidecar.rs
// let mut child = Command::new(sidecar_path())
//     .stdin(Stdio::piped())
//     .stdout(Stdio::piped())
//     .stderr(Stdio::piped())
//     .spawn()?;
// // Rust escribe Request JSON a child.stdin y lee Response JSON de child.stdout
// ```
//
// # Cómo probarlo a mano sin Rust
//
// ```bash
// go build -o /tmp/killer-go ./go
// echo '{"id":"1","method":"ping","params":{}}' | /tmp/killer-go
// # {"id":"1","result":"pong","error":null}
//
// echo '{"id":"2","method":"list_dir","params":{"path":"."}}' | /tmp/killer-go
// echo '{"id":"3","method":"read_file","params":{"path":"./README.md"}}' | /tmp/killer-go
// echo '{"id":"4","method":"tree","params":{"root":".","maxDepth":2,"showHidden":false}}' | /tmp/killer-go
// ```
//
// # Protocolo documentado
//
// Ver `internal/ipc/protocol.go` y `internal/ipc/server.go`.
// Cada línea stdin es un `Request`, cada línea stdout es un `Response`.
//
// stderr es solo logs humanos y no interfiere con el túnel.
func main() {
	// Contexto que se cancela con SIGINT/SIGTERM (cuando Rust mata el sidecar)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		fmt.Fprintf(os.Stderr, "[go] signal %v received, shutting down\n", sig)
		cancel()
	}()

	// El servicio de FS es stateless y thread-safe
	svc := fs.NewService()

	// El servidor IPC bloquea hasta EOF o cancel
	srv := ipc.NewServer(svc, os.Stdin, os.Stdout)

	// Mensaje de arranque en stderr (visible en logs de Tauri)
	fmt.Fprintln(os.Stderr, "[go] killer-go sidecar starting... PID:", os.Getpid())

	if err := srv.Run(ctx); err != nil && err != context.Canceled {
		fmt.Fprintf(os.Stderr, "[go] server error: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintln(os.Stderr, "[go] graceful shutdown")
}
