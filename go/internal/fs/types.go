package fs

// Package fs — tipos compartidos entre Go ↔ Rust ↔ SolidJS.
//
// Estos structs son el "contrato" JSON. Rust los reenvía tal cual a
// Tauri, y Solid los consume en `src/types/cache.ts`.
//
// Ejemplo de JSON que produce ListDir("/src"):
//
// ```json
// {
//   "type": "dir",
//   "path": "/src",
//   "name": "src",
//   "directorys": [
//     { "type":"dir", "path":"/src/components", "name":"components", "directorys":[], "files":[] }
//   ],
//   "files": [
//     { "type":"file", "path":"/src/App.tsx", "name":"App.tsx" }
//   ]
// }
// ```
//
// Ejemplo de uso en Go:
//
// ```go
// import "killer/internal/fs"
//
// svc := fs.NewService()
// dir, err := svc.ListDir("/home/tu/proyecto")
// if err != nil { log.Fatal(err) }
// fmt.Printf("carpetas: %d archivos: %d\n", len(dir.Directorys), len(dir.Files))
// ```

// Directory representa una carpeta del filesystem.
// Mantiene el nombre exacto del campo `directorys` (con s) para
// compatibilidad con el frontend actual `src/types/cache.ts`.
type Directory struct {
	Type       string      `json:"type"`       // siempre "dir"
	Path       string      `json:"path"`       // ruta absoluta normalizada
	Name       string      `json:"name"`       // basename
	Directorys []Directory `json:"directorys"` // subcarpetas (solo 1 nivel si lista plana, o árbol si tree)
	Files      []FileDeck  `json:"files"`      // archivos directos
}

// FileDeck es la versión ligera de un archivo (sin contenido).
// Se usa en listados de directorios para no cargar datos pesados.
type FileDeck struct {
	Type string `json:"type"` // siempre "file"
	Name string `json:"name"`
	Path string `json:"path"`
}

// File es el archivo con contenido. Es lo que lee `ReadFile`.
type File struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Data      string `json:"data"`                // contenido utf8 (o base64 si binario según flag)
	Extension *string `json:"extension,omitempty"` // ej: "tsx", "md", null si no tiene
	Size      int64  `json:"size"`                // bytes
	IsBinary  bool   `json:"isBinary"`            // true si detectamos binario
}

// Stat es info rápida de un path (para validaciones).
type Stat struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	IsDir    bool   `json:"isDir"`
	Size     int64  `json:"size"`
	ModTime  string `json:"modTime"` // RFC3339
	Mode     string `json:"mode"`    // ej: "drwxr-xr-x"
}

// TreeOptions controla la profundidad del árbol.
type TreeOptions struct {
	Root     string `json:"root"`
	MaxDepth int    `json:"maxDepth"` // 0 = infinito, 1 = solo hijos directos
	ShowHidden bool `json:"showHidden"` // incluir dotfiles
}
