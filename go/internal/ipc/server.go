package ipc

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"

	"killer/internal/fs"
)

// Server es el loop que lee de `r` (stdin) y escribe a `w` (stdout).
// Es intencionalmente simple: sin TCP, sin HTTP, solo stdio.
// Esto funciona perfecto como Tauri sidecar porque Rust ya gestiona
// el lifecycle del proceso hijo.
//
// Arquitectura del túnel:
//
// ```
// Solid (JS) --invoke--> Rust (Tauri cmd) --stdin JSON--> Go Service --stdout JSON--> Rust --return--> JS
//                \__________________________ IPC TÚNEL ___________________________/
// ```
//
// Ejemplo de ciclo:
//
// ```go
// svc := fs.NewService()
// srv := ipc.NewServer(svc, os.Stdin, os.Stdout)
// srv.Run(context.Background()) // bloquea hasta EOF o cancel
// ```
type Server struct {
	svc *fs.Service
	r   io.Reader
	w   io.Writer
	mu  sync.Mutex // protege writes concurrentes a w
}

// NewServer crea un servidor IPC sobre pipes dados.
func NewServer(svc *fs.Service, r io.Reader, w io.Writer) *Server {
	return &Server{svc: svc, r: r, w: w}
}

// Run es el corazón: lee línea a línea, despacha y responde.
// Respeta `ctx` para shutdown graceful (ej: SIGTERM desde Rust).
func (s *Server) Run(ctx context.Context) error {
	scanner := bufio.NewScanner(s.r)
	// Aumentar buffer a 10MB para payloads de archivos medianos
	const maxCap = 10 * 1024 * 1024
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxCap)

	// Log a stderr, nunca a stdout (stdout es el túnel)
	fmt.Fprintln(os.Stderr, "[go] ipc server ready (stdio mode)")

	for {
		select {
		case <-ctx.Done():
			fmt.Fprintln(os.Stderr, "[go] context cancelled, shutting down")
			return ctx.Err()
		default:
		}

		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				fmt.Fprintf(os.Stderr, "[go] scanner error: %v\n", err)
				return err
			}
			// EOF = Rust cerró stdin => terminamos
			fmt.Fprintln(os.Stderr, "[go] stdin EOF, exiting")
			return nil
		}

		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		// Copiar porque scanner reutiliza buffer
		lineCopy := make([]byte, len(line))
		copy(lineCopy, line)

		// Procesar sincrónicamente para mantener orden. Para alta concurrencia
		// podríamos lanzar goroutines y usar request ID para reordenar, pero
		// el FS es I/O bound y line-delimited es más simple secuencial.
		// Si necesitas paralelismo, descomenta el `go`:
		// go s.handleLine(lineCopy)
		s.handleLine(lineCopy)
	}
}

// handleLine parsea un Request y escribe un Response.
func (s *Server) handleLine(line []byte) {
	var req Request
	if err := json.Unmarshal(line, &req); err != nil {
		// Si no podemos ni parsear el ID, usamos "unknown"
		msg := fmt.Sprintf("invalid json: %v", err)
		fmt.Fprintf(os.Stderr, "[go] %s | raw: %s\n", msg, string(line))
		s.writeResponse(errResponse("unknown", msg))
		return
	}

	// Log debug a stderr
	fmt.Fprintf(os.Stderr, "[go] -> %s %s\n", req.Method, string(req.Params))

	resp := s.dispatch(req)
	s.writeResponse(resp)
}

// dispatch mapea method → fs.Service y construye la Response.
func (s *Server) dispatch(req Request) Response {
	switch req.Method {

	case "ping":
		return okResponse(req.ID, "pong")

	case "list_dir":
		var p ListDirParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params list_dir: %v", err))
		}
		dir, err := s.svc.ListDir(p.Path)
		if err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, dir)

	case "read_file":
		var p ReadFileParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params read_file: %v", err))
		}
		f, err := s.svc.ReadFile(p.Path)
		if err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, f)

	case "stat":
		var p StatParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params stat: %v", err))
		}
		st, err := s.svc.Stat(p.Path)
		if err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, st)

	case "tree":
		var p TreeParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params tree: %v", err))
		}
		tree, err := s.svc.Tree(fs.TreeOptions{
			Root:       p.Root,
			MaxDepth:   p.MaxDepth,
			ShowHidden: p.ShowHidden,
		})
		if err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, tree)

	case "write_file":
		var p WriteFileParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params write_file: %v", err))
		}
		if err := s.svc.WriteFile(p.Path, p.Data); err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, map[string]bool{"ok": true})

	case "delete":
		var p DeleteParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params delete: %v", err))
		}
		if err := s.svc.Delete(p.Path); err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, map[string]bool{"ok": true})

	case "exists":
		var p ExistsParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params exists: %v", err))
		}
		exists := s.svc.Exists(p.Path)
		return okResponse(req.ID, map[string]bool{"exists": exists})

	case "ensure_dir":
		var p EnsureDirParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return errResponse(req.ID, fmt.Sprintf("bad params ensure_dir: %v", err))
		}
		if err := s.svc.EnsureDir(p.Path); err != nil {
			return errResponse(req.ID, err.Error())
		}
		return okResponse(req.ID, map[string]bool{"ok": true})

	default:
		return errResponse(req.ID, fmt.Sprintf("unknown method %q", req.Method))
	}
}

func (s *Server) writeResponse(resp Response) {
	b, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[go] marshal error: %v\n", err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	// Cada respuesta es una línea
	fmt.Fprintln(s.w, string(b))
	fmt.Fprintf(os.Stderr, "[go] <- %s %v\n", resp.ID, resp.Error == nil)
}
