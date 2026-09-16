package fs

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

// Service es el corazón del filesystem.
// No guarda estado mutable, por lo que es seguro para uso concurrente.
//
// Ejemplo:
//
// ```go
// svc := NewService()
// // 1) Listar carpeta actual
// dir, _ := svc.ListDir(".")
// // 2) Leer archivo
// file, _ := svc.ReadFile("./README.md")
// fmt.Println(file.Data)
// // 3) Árbol de 2 niveles
// tree, _ := svc.Tree(TreeOptions{Root: ".", MaxDepth: 2})
// ```
type Service struct{}

// NewService crea un servicio filesystem.
// No requiere configuración; opera sobre el FS real del OS.
func NewService() *Service { return &Service{} }

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

// cleanPath normaliza y valida un path.
// - Limpia `..` y `.`
// - Asegura que no sea vacío
// - En Windows normaliza separators a `/` para JSON consistente
func cleanPath(p string) (string, error) {
	if strings.TrimSpace(p) == "" {
		return "", fmt.Errorf("path vacío")
	}
	// filepath.Clean usa OS separator, luego lo convertimos a slash para JSON
	cleaned := filepath.Clean(p)
	// Convertir a slash para el contrato JSON (frontend espera "/")
	slashed := filepath.ToSlash(cleaned)
	// Si es relativo, lo dejamos relativo; si absoluto, lo preservamos
	return slashed, nil
}

// isHidden detecta dotfiles en Unix y ocultos básicos.
func isHidden(name string) bool {
	return strings.HasPrefix(name, ".")
}

// isBinary heurística simple: si contiene NUL bytes o no es utf8 válido.
func isBinary(data []byte) bool {
	if bytes.Contains(data, []byte{0}) {
		return true
	}
	// Si más del 10% no es texto imprimible, trátalo como binario (simplificado)
	if !utf8.Valid(data) {
		return true
	}
	return false
}

// ext extrae extensión sin punto, lowercase.
func ext(name string) *string {
	e := strings.TrimPrefix(filepath.Ext(name), ".")
	if e == "" {
		return nil
	}
	lower := strings.ToLower(e)
	return &lower
}

// sortEntries ordena directorios y archivos alfabéticamente (case-insensitive)
func sortEntries(dirs []Directory, files []FileDeck) {
	sort.Slice(dirs, func(i, j int) bool {
		return strings.ToLower(dirs[i].Name) < strings.ToLower(dirs[j].Name)
	})
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})
}

// ---------------------------------------------------------------------------
// API pública — usada por el servidor IPC
// ---------------------------------------------------------------------------

// ListDir lista UN nivel de una carpeta.
// No es recursivo: solo hijos directos.
//
// ```go
// dir, err := svc.ListDir("/home/user/docs")
// // dir.Directorys = subcarpetas directas
// // dir.Files = archivos directos
// ```
func (s *Service) ListDir(rawPath string) (*Directory, error) {
	path, err := cleanPath(rawPath)
	if err != nil {
		return nil, err
	}
	// Resolver a path real del OS para os.ReadDir
	osPath := filepath.FromSlash(path)

	info, err := os.Stat(osPath)
	if err != nil {
		return nil, fmt.Errorf("stat %q: %w", path, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%q no es un directorio", path)
	}

	entries, err := os.ReadDir(osPath)
	if err != nil {
		return nil, fmt.Errorf("readdir %q: %w", path, err)
	}

	var dirs []Directory
	var files []FileDeck
	for _, e := range entries {
		name := e.Name()
		// Por defecto ocultamos dotfiles; se puede exponer un flag si hace falta
		// if isHidden(name) { continue }

		// Construir path hijo con slash
		childPath := filepath.ToSlash(filepath.Join(osPath, name))
		// Normalizar doble slash root "/"
		if !strings.HasPrefix(childPath, "/") && filepath.IsAbs(osPath) {
			// mantener absoluto
		}

		if e.IsDir() {
			dirs = append(dirs, Directory{
				Type:       "dir",
				Path:       childPath + "/", // convención con trailing slash para dirs
				Name:       name,
				Directorys: []Directory{},
				Files:      []FileDeck{},
			})
		} else {
			files = append(files, FileDeck{
				Type: "file",
				Name: name,
				Path: childPath,
			})
		}
	}
	sortEntries(dirs, files)

	// Nombre de la carpeta actual = basename o "/" si es root
	base := filepath.Base(osPath)
	if osPath == "." || osPath == "/" || base == "." {
		// Si es root o relativo ".", usar el path limpio como nombre
		if path == "/" || path == "." {
			base = filepath.Base(path)
			if base == "/" || base == "." || base == "" {
				base = "root"
				// Si es absoluto FS real, intenta usar basename del absoluto
				if abs, err := filepath.Abs(osPath); err == nil {
					base = filepath.Base(abs)
					if base == "/" || base == "." {
						base = "/"
					}
				}
			}
		}
	}
	// Para path "/" queremos name = "/"
	if path == "/" {
		base = "/"
	}

	return &Directory{
		Type:       "dir",
		Path:       path + func() string { if strings.HasSuffix(path, "/") { return "" }; return "/" }(),
		Name:       base,
		Directorys: dirs,
		Files:      files,
	}, nil
}

// ReadFile lee el contenido de un archivo.
// - Limita a 10 MB por defecto para evitar OOM
// - Detecta binario y marca IsBinary
// - Retorna Data como string utf8; si binario, Data es mensaje placeholder
//
// ```go
// f, err := svc.ReadFile("/etc/hosts")
// if f.IsBinary { /* mostrar hex o descargar */ }
// ```
func (s *Service) ReadFile(rawPath string) (*File, error) {
	path, err := cleanPath(rawPath)
	if err != nil {
		return nil, err
	}
	osPath := filepath.FromSlash(path)

	info, err := os.Stat(osPath)
	if err != nil {
		return nil, fmt.Errorf("stat %q: %w", path, err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("%q es un directorio, no un archivo", path)
	}

	const maxSize = 10 << 20 // 10 MB
	if info.Size() > maxSize {
		return nil, fmt.Errorf("archivo %q muy grande (%d bytes > 10MB)", path, info.Size())
	}

	f, err := os.Open(osPath)
	if err != nil {
		return nil, fmt.Errorf("open %q: %w", path, err)
	}
	defer f.Close()

	// Leer con límite
	limited := io.LimitReader(f, maxSize+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("read %q: %w", path, err)
	}
	if int64(len(data)) > maxSize {
		return nil, fmt.Errorf("archivo %q excede 10MB", path)
	}

	binary := isBinary(data)
	var dataStr string
	if binary {
		// Para binarios no enviamos bytes crudos; frontend puede pedir download separado
		dataStr = fmt.Sprintf("[binary file %d bytes]", len(data))
	} else {
		dataStr = string(data)
	}

	return &File{
		Path:      path,
		Name:      info.Name(),
		Data:      dataStr,
		Extension: ext(info.Name()),
		Size:      info.Size(),
		IsBinary:  binary,
	}, nil
}

// ReadFileRaw lee bytes crudos sin interpretación (útil para imágenes).
// No se expone por IPC JSON por defecto para evitar payload gigante.
func (s *Service) ReadFileRaw(rawPath string) ([]byte, error) {
	path, err := cleanPath(rawPath)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(filepath.FromSlash(path))
}

// Stat devuelve metadata de un path (archivo o directorio).
//
// ```go
// st, _ := svc.Stat("/src")
// fmt.Println(st.IsDir, st.Size)
// ```
func (s *Service) Stat(rawPath string) (*Stat, error) {
	path, err := cleanPath(rawPath)
	if err != nil {
		return nil, err
	}
	osPath := filepath.FromSlash(path)
	info, err := os.Stat(osPath)
	if err != nil {
		return nil, fmt.Errorf("stat %q: %w", path, err)
	}
	return &Stat{
		Path:    path,
		Name:    info.Name(),
		IsDir:   info.IsDir(),
		Size:    info.Size(),
		ModTime: info.ModTime().Format(time.RFC3339),
		Mode:    info.Mode().String(),
	}, nil
}

// Tree construye un árbol recursivo hasta MaxDepth.
// MaxDepth 0 = sin límite (¡cuidado con carpetas gigantes!).
// Internamente usa ListDir recursivo pero reutiliza el FS real.
//
// ```go
// tree, _ := svc.Tree(TreeOptions{Root: ".", MaxDepth: 2, ShowHidden: false})
// // tree.Directorys[0].Directorys ... 2 niveles
// ```
func (s *Service) Tree(opts TreeOptions) (*Directory, error) {
	root, err := cleanPath(opts.Root)
	if err != nil {
		return nil, err
	}
	if opts.MaxDepth < 0 {
		opts.MaxDepth = 0
	}
	return s.treeRecursive(root, opts, 0)
}

func (s *Service) treeRecursive(current string, opts TreeOptions, depth int) (*Directory, error) {
	// Listar nivel actual
	dir, err := s.ListDir(current)
	if err != nil {
		return nil, err
	}
	// Si llegamos a profundidad límite, no expandir más
	if opts.MaxDepth != 0 && depth >= opts.MaxDepth {
		// Vaciar hijos para indicar que se puede seguir expandiendo pero no lo hacemos
		return dir, nil
	}

	// Expandir cada subdirectorio recursivamente
	for i := range dir.Directorys {
		childPath := strings.TrimSuffix(dir.Directorys[i].Path, "/")
		sub, err := s.treeRecursive(childPath, opts, depth+1)
		if err != nil {
			// Si un subdirectorio no es accesible (permisos), lo salteamos en lugar de fallar todo
			continue
		}
		dir.Directorys[i] = *sub
	}
	return dir, nil
}

// Walk recorre el árbol y ejecuta fn por cada archivo/carpeta encontrado.
// Es útil para búsquedas o indexación.
//
// ```go
// svc.Walk("/src", func(path string, d fs.DirEntry) error {
//     fmt.Println(path)
//     return nil
// })
// ```
func (s *Service) Walk(root string, fn fs.WalkDirFunc) error {
	clean, err := cleanPath(root)
	if err != nil {
		return err
	}
	return filepath.WalkDir(filepath.FromSlash(clean), fn)
}

// Exists verifica existencia sin error si no existe.
func (s *Service) Exists(rawPath string) bool {
	path, err := cleanPath(rawPath)
	if err != nil {
		return false
	}
	_, err = os.Stat(filepath.FromSlash(path))
	return err == nil
}

// EnsureDir crea la carpeta y padres si no existe (mkdir -p).
func (s *Service) EnsureDir(rawPath string) error {
	path, err := cleanPath(rawPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(filepath.FromSlash(path), 0o755)
}

// WriteFile escribe contenido (crea o trunca). Usado para guardar edits del editor.
func (s *Service) WriteFile(rawPath string, data string) error {
	path, err := cleanPath(rawPath)
	if err != nil {
		return err
	}
	osPath := filepath.FromSlash(path)
	// Asegurar directorio padre existe
	if err := os.MkdirAll(filepath.Dir(osPath), 0o755); err != nil {
		return err
	}
	return os.WriteFile(osPath, []byte(data), 0o644)
}

// Delete borra archivo o carpeta recursiva.
func (s *Service) Delete(rawPath string) error {
	path, err := cleanPath(rawPath)
	if err != nil {
		return err
	}
	return os.RemoveAll(filepath.FromSlash(path))
}
