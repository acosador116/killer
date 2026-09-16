/**
 * @file fsCache.ts
 * @description Cache reactivo del filesystem — capa entre Go y el UI.
 *
 * Este módulo es el "cerebro" que el frontend consulta primero.
 * Guarda el último árbol cargado en memoria y en localStorage (opcional)
 * para que la navegación sea instantánea.
 *
 * ## Arquitectura
 * ```text
 *  Go (FS real) --tree/listDir--> fsService --write--> fsCache (memoria)
 *                                                    └─> Explorer / App.tsx
 *  Mock (archs) --------------------fallback---------> fsCache
 * ```
 *
 * ## Ejemplo de uso
 * ```ts
 * import { fsCache } from "../cache/fsCache"
 * import { archs } from "./file"
 *
 * // 1) Carga inicial: intenta Go, si falla usa archs mock
 * const root = await fsCache.init(archs)
 *
 * // 2) Navegar a subcarpeta
 * const srcDir = await fsCache.navigate("/src")
 *
 * // 3) Leer archivo con cache
 * const file = await fsCache.readFile("/src/App.tsx")
 *
 * // 4) Invalidar y recargar
 * await fsCache.refresh()
 * ```
 */

import type { Directory, Fille } from "../types/fs"
import { fileService } from "../services/fileService"
import { fsService } from "../services/fsService"
import { archs as mockArchs } from "./file"

// Estado en memoria (singleton)
let cachedTree: Directory | null = null
let cachedRootPath: string = "."
let isRealFs = false

export const fsCache = {
  /** Indica si el cache actual viene del FS real (Go) o del mock. */
  get isReal(): boolean {
    return isRealFs
  },

  /** Último árbol cacheado (o null si no se ha cargado). */
  get tree(): Directory | null {
    return cachedTree
  },

  /**
   * Inicializa el cache. Intenta cargar desde Go, fallback a `fallbackArch`.
   *
   * ```ts
   * const root = await fsCache.init(archs, ".")
   * ```
   */
  async init(fallbackArch: Directory = mockArchs, rootPath = "."): Promise<Directory> {
    cachedRootPath = rootPath
    // Probar si Go está vivo
    const available = await fileService.isRealFsAvailable().catch(() => false)
    isRealFs = available

    if (available) {
      try {
        // Intentar árbol de profundidad 2 como carga inicial rápida
        const tree = await fsService.tree(rootPath, 3, false)
        cachedTree = tree
        console.log("[fsCache] loaded real FS tree from Go, root:", tree.path)
        return tree
      } catch (e) {
        console.warn("[fsCache] failed to load real tree, fallback to mock:", e)
      }
    }

    // Fallback mock
    isRealFs = false
    cachedTree = fallbackArch
    console.log("[fsCache] using mock archs")
    return fallbackArch
  },

  /**
   * Navega a un path y retorna su Directory.
   * Si el path ya está en el árbol cacheado, lo resuelve sin red.
   * Si no, hace `listDir` al Go.
   *
   * ```ts
   * const dir = await fsCache.navigate("/src/components")
   * ```
   */
  async navigate(path: string): Promise<Directory> {
    // 1) Intentar resolver en cache local (rápido)
    if (cachedTree) {
      const found = fileService.getDirectoryByPath(path, cachedTree)
      if (found) return found
    }

    // 2) Intentar fetch real
    if (isRealFs) {
      try {
        const fetched = await fsService.listDir(path)
        // Opcional: mergear al árbol cacheado (para no perder futuras navegaciones)
        // Aquí simplificamos: no mergeamos, solo retornamos
        return fetched
      } catch (e) {
        console.warn("[fsCache] navigate via Go failed:", e)
      }
    }

    // 3) Fallback mock
    const fallback = fileService.getDirectoryByPath(path, cachedTree ?? mockArchs)
    if (fallback) return fallback
    throw new Error(`directory not found: ${path}`)
  },

  /**
   * Lee un archivo (prioriza Go).
   * ```ts
   * const f = await fsCache.readFile("/src/App.tsx")
   * ```
   */
  async readFile(path: string): Promise<Fille | null> {
    return fileService.readFile(path)
  },

  /** Invalida el cache y recarga desde el origen. */
  async refresh(): Promise<Directory> {
    cachedTree = null
    return this.init(mockArchs, cachedRootPath)
  },

  /** Limpia el cache en memoria. */
  clear() {
    cachedTree = null
    isRealFs = false
  },

  /**
   * Helper para el explorer: lista hijos de un path usando cache.
   * Retorna `Directory` con `directorys` y `files`.
   */
  async list(path: string): Promise<Directory> {
    return this.navigate(path)
  },
}
