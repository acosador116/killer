/**
 * @file fs.ts
 * @description Tipos canónicos del filesystem compartidos entre
 *   Go (`internal/fs/types.go`) ↔ Rust (`go_bridge`) ↔ SolidJS.
 *
 * Estos tipos son el contrato JSON del túnel IPC.
 *
 * ## Arquitectura
 * ```text
 * Go:  Directory { type:"dir", path:"/src/", name:"src", directorys:[...], files:[...] }
 *          ↕ JSON stdout
 * Rust: serde_json::Value (reenvía tal cual)
 *          ↕ invoke("fs_list_dir")
 * JS:   Directory (este archivo)
 * ```
 *
 * ## Ejemplo de uso en SolidJS
 * ```ts
 * import { fsService } from "../services/fsService"
 * import type { Directory, Fille } from "../types/fs"
 *
 * // Listar carpeta
 * const dir: Directory = await fsService.listDir("/src")
 * console.log(dir.directorys.map(d => d.name)) // ["components", "hooks"]
 *
 * // Leer archivo
 * const file: Fille = await fsService.readFile("/src/App.tsx")
 * console.log(file.data)
 *
 * // Árbol recursivo
 * const tree: Directory = await fsService.tree(".", 2, false)
 * ```
 *
 * ## Compatibilidad con `cache.ts`
 * Este archivo es la fuente de verdad. `cache.ts` re-exporta estos tipos
 * para no romper imports existentes `from "../types/cache"`.
 */

// Representa una carpeta. Nota: `directorys` mantiene la `s` histórica
// para compatibilidad con el mock `src/cache/file.ts`.
export type Directory = {
  type: "dir"
  path: string // ej: "/src/components/" (siempre con trailing slash para dirs)
  name: string // ej: "components"
  directorys: Directory[]
  files: FileDeck[]
}

// Versión ligera de archivo (sin contenido), usada en listados
export type FileDeck = {
  type: "file"
  name: string // ej: "App.tsx"
  path: string // ej: "/src/App.tsx"
}

// Archivo con contenido (resultado de `read_file`)
export type Fille = {
  path: string
  name: string
  data: string // contenido utf8 o "[binary file ...]" si binario
  extension?: string // ej: "tsx"
  size?: number
  isBinary?: boolean
}

// Alias histórico: el frontend antiguo usaba `FilleDeck` con typo
export type FilleDeck = FileDeck

export type ListFiles = {
  files: Fille[]
}

// Metadata rápida de un path
export type Stat = {
  path: string
  name: string
  isDir: boolean
  size: number
  modTime: string // RFC3339
  mode: string
}

// Opciones para `tree`
export type TreeOptions = {
  root: string
  maxDepth: number // 0 = infinito
  showHidden: boolean
}
