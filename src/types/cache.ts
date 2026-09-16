/**
 * @file cache.ts — re-exporta tipos canónicos de `fs.ts`
 *
 * Se mantiene este archivo para compatibilidad con imports existentes:
 * ```ts
 * import { Directory } from "../types/cache"
 * ```
 * Internamente delega a `fs.ts` que es el contrato real con Go.
 */

export type { Directory, FileDeck, FilleDeck, Fille, ListFiles, Stat, TreeOptions } from "./fs"
