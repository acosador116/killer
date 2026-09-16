/**
 * @file fileService.ts
 * @description Servicio híbrido filesystem — mock (web) + real (Tauri+Go)
 *
 * Este archivo es el puente que el frontend realmente importa.
 * Internamente decide si usar el FS real vía `fsService` (túnel Go)
 * o el mock `src/cache/file.ts` para modo web.
 *
 * ## Arquitectura
 * ```text
 *  App.tsx  ──> fileService ──?──> fsService (Tauri invoke → Rust → Go)
 *                  │
 *                  └────> archs / listFiles (mock web)
 * ```
 *
 * ## Uso en componentes
 * ```ts
 * import { fileService } from "../services/fileService"
 *
 * // Sincrónico (mock) — para compatibilidad con código existente
 * const dir = fileService.getDirectoryByPath("/src", archs)
 * const parent = fileService.getParentByPath("/src/components", archs)
 *
 * // Asíncrono (real) — preferir cuando estás en Tauri
 * const realDir = await fileService.listDir("/src") // intenta Go, fallback mock
 * const file = await fileService.readFile("/src/App.tsx")
 * const tree = await fileService.tree(".", 2)
 * ```
 *
 * ## Por qué híbrido
 * - En `vite dev` (web) no hay sidecar Go, así que seguimos usando `archs`.
 * - En `tauri dev` / `tauri build`, Go está vivo y usamos FS real.
 * - El fallback es transparente: si `fsService` falla, se usa mock.
 */

import { listFiles, archs as mockArchs } from "../cache/file"
import { Directory, Fille } from "../types/cache"
import { fsService } from "./fsService"

export const fileService = {
  // -------------------------------------------------------------------------
  // API Sincrónica Mock — compatibilidad con código existente
  // -------------------------------------------------------------------------

  /** Busca archivo en el mock `listFiles` */
  getFileByPath(path: string): Fille | null {
    for (const file of listFiles.files) {
      if (file.path == path) return file
    }
    return null
  },

  /** Busca directorio recursivo en el árbol dado (mock o real). */
  getDirectoryByPath(path: string, archss: Directory): Directory | null {
    if (path === archss.path) return archss
    for (const dir of archss.directorys) {
      const found = this.getDirectoryByPath(path, dir)
      if (found) return found
    }
    return null
  },

  /** Devuelve el padre de un directorio. null si es raíz. */
  getParentByPath(path: string, archss: Directory): Directory | null {
    for (const dir of archss.directorys) {
      if (dir.path === path) return archss
      const found = this.getParentByPath(path, dir)
      if (found) return found
    }
    return null
  },

  // -------------------------------------------------------------------------
  // API Asíncrona Real — túnel Go (con fallback mock)
  // -------------------------------------------------------------------------

  /**
   * Lista un directorio usando Go si está disponible.
   * Fallback: busca en `archss` (normalmente `archs` mock).
   *
   * ```ts
   * const dir = await fileService.listDir("/src", archs)
   * ```
   */
  async listDir(path: string, fallbackArch?: Directory): Promise<Directory> {
    const fallback = fallbackArch ?? mockArchs
    try {
      // Intentar FS real
      const real = await fsService.listDir(path)
      return real
    } catch (e) {
      // Fallback mock: buscar en árbol
      console.warn("[fileService] listDir fallback to mock:", e)
      const found = this.getDirectoryByPath(path, fallback)
      if (found) return found
      // Si no se encuentra ni en mock, retornar root
      return fallback
    }
  },

  /**
   * Lee archivo usando Go. Fallback a mock.
   * ```ts
   * const file = await fileService.readFile("/src/App.tsx")
   * ```
   */
  async readFile(path: string): Promise<Fille | null> {
    try {
      const real = await fsService.readFile(path)
      return real
    } catch (e) {
      console.warn("[fileService] readFile fallback to mock:", e)
      return this.getFileByPath(path)
    }
  },

  /**
   * Árbol recursivo. Fallback: retorna mock tal cual.
   * ```ts
   * const tree = await fileService.tree(".", 2, false, archs)
   * ```
   */
  async tree(root: string, maxDepth: number, showHidden: boolean, fallbackArch?: Directory): Promise<Directory> {
    const fallback = fallbackArch ?? mockArchs
    try {
      return await fsService.tree(root, maxDepth, showHidden)
    } catch (e) {
      console.warn("[fileService] tree fallback to mock:", e)
      return fallback
    }
  },

  /** Wrapper directo a fsService.stat con fallback null */
  async stat(path: string): Promise<import("../types/fs").Stat | null> {
    try {
      return await fsService.stat(path)
    } catch {
      return null
    }
  },

  /** Verifica si el FS real está disponible (Go vivo). */
  async isRealFsAvailable(): Promise<boolean> {
    return fsService.isAvailable()
  },

  // -------------------------------------------------------------------------
  // Helpers sincrónicos útiles para el explorer
  // -------------------------------------------------------------------------

  /** Convierte un path a nombre base (último segmento) */
  basename(path: string): string {
    return path.split("/").filter(Boolean).pop() ?? path
  },

  /** Normaliza path para comparación (quita trailing slash, limpia) */
  normalize(path: string): string {
    if (!path) return "/"
    let p = path.replace(/\/+/g, "/")
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
    if (!p.startsWith("/")) p = "/" + p
    return p
  },
}
