/**
 * @file fsService.ts
 * @description Cliente IPC para el túnel Rust ↔ Go.
 *
 * Este servicio es la capa que SolidJS usa para hablar con el filesystem real.
 * Internamente hace `invoke("fs_*")` que Rust proxy-a a Go via stdio.
 * Si no estamos en Tauri (web), hace fallback a mock para no romper el dev.
 *
 * ## Arquitectura del túnel
 * ```text
 * SolidJS                    Rust (Tauri)                Go
 *  fsService  --invoke-->  go_bridge::fs_*  --stdin-->  ipc.Server
 *             <--Value--               <--stdout--   fs.Service
 * ```
 *
 * ## Ejemplo de uso
 * ```ts
 * import { fsService } from "./fsService"
 *
 * // ¿Estamos en Tauri con Go disponible?
 * if (await fsService.isAvailable()) {
 *   const dir = await fsService.listDir("/workspaces/blonter/killer")
 *   console.log(dir.files)
 * } else {
 *   console.log("modo web mock")
 * }
 *
 * // Leer archivo real
 * const file = await fsService.readFile("/src/App.tsx")
 * // file.data contiene el contenido
 *
 * // Árbol de 2 niveles
 * const tree = await fsService.tree(".", 2, false)
 * ```
 *
 * ## Fallback web
 * Cuando `window.__TAURI__` no existe o `fs_ping` falla, todas las funciones
 * lanzan error que el caller puede capturar y usar `fileService` mock.
 */

import type { Directory, Fille, Stat } from "../types/fs"

// Detecta si estamos dentro de Tauri (con ventana nativa)
function isTauri(): boolean {
  // Tauri expone `window.__TAURI__` y `window.__TAURI_INVOKE__`
  return typeof window !== "undefined" && "__TAURI__" in window
}

// Wrapper seguro para `invoke` con import dinámico
// Evita que Vite falle si `@tauri-apps/api` no está instalado en web
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error("not in tauri context")
  // Import dinámico para no cargar el módulo en web
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

export const fsService = {
  /** Verifica si el túnel Go está vivo. */
  async isAvailable(): Promise<boolean> {
    if (!isTauri()) return false
    try {
      const res = await tauriInvoke<string>("fs_ping", {})
      return res === "pong"
    } catch {
      return false
    }
  },

  /** Ping genérico. */
  async ping(): Promise<string> {
    return tauriInvoke<string>("fs_ping")
  },

  /**
   * Lista un directorio (un nivel).
   * @param path - ruta absoluta o relativa, ej: "/src" o "."
   * @example
   * ```ts
   * const dir = await fsService.listDir("/workspaces/killer/src")
   * // dir.directorys -> subcarpetas
   * // dir.files -> archivos
   * ```
   */
  async listDir(path: string): Promise<Directory> {
    return tauriInvoke<Directory>("fs_list_dir", { path })
  },

  /**
   * Lee contenido de un archivo (máx 10 MB).
   * @example
   * ```ts
   * const f = await fsService.readFile("/src/App.tsx")
   * console.log(f.data, f.extension) // "tsx"
   * ```
   */
  async readFile(path: string): Promise<Fille> {
    return tauriInvoke<Fille>("fs_read_file", { path })
  },

  /** Stat de un path. */
  async stat(path: string): Promise<Stat> {
    return tauriInvoke<Stat>("fs_stat", { path })
  },

  /**
   * Árbol recursivo.
   * @param root - carpeta raíz
   * @param maxDepth - 0 = infinito, 1 = solo hijos, 2 = hasta nietos...
   * @param showHidden - incluir dotfiles
   * ```ts
   * const tree = await fsService.tree("/src", 3, false)
   * ```
   */
  async tree(root: string, maxDepth: number, showHidden: boolean): Promise<Directory> {
    return tauriInvoke<Directory>("fs_tree", { root, maxDepth, showHidden })
  },

  /** Escribe archivo (crea o trunca). */
  async writeFile(path: string, data: string): Promise<void> {
    await tauriInvoke("fs_write_file", { path, data })
  },

  /** Borra archivo o directorio recursivo. */
  async delete(path: string): Promise<void> {
    await tauriInvoke("fs_delete", { path })
  },

  /** Verifica existencia. */
  async exists(path: string): Promise<boolean> {
    return tauriInvoke<boolean>("fs_exists", { path })
  },

  /** Asegura directorio existe (mkdir -p). */
  async ensureDir(path: string): Promise<void> {
    await tauriInvoke("fs_ensure_dir", { path })
  },

  // -------------------------------------------------------------------------
  // Helpers de conveniencia para el frontend
  // -------------------------------------------------------------------------

  /**
   * Carga el directorio inicial intentando primero el FS real,
   * y si falla usa el mock `archs`.
   * Útil en `App.tsx` para no romper el modo web.
   *
   * ```ts
   * const initial = await fsService.loadInitialDir(".", archs)
   * ```
   */
  async loadInitialDir(fallback: Directory, preferredPath?: string): Promise<Directory> {
    // Si nos piden un path específico y existe, usarlo
    if (preferredPath) {
      try {
        return await this.listDir(preferredPath)
      } catch {}
    }
    // Intentar listar cwd (".")
    try {
      return await this.listDir(".")
    } catch {}
    // Intentar tree de 1 nivel
    try {
      return await this.tree(".", 1, false)
    } catch {}
    // Fallback mock
    return fallback
  },
}
