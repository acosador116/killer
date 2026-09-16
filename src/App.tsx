/**
 * @file App.tsx — Orquestador principal con soporte Go + fallback web
 *
 * ## Arquitectura con túnel IPC
 * ```text
 *  App.tsx
 *   ├─> fsCache.init(archs) ──> fsService.tree() ──invoke--> Rust ──stdin--> Go
 *   ├─> Explorer (directory + parent) ──> chooseDirectory (async)
 *   ├─> FileVisualizer (currentFile)
 *   └─> ChooseDirectoryOfEnter (rootDir)
 * ```
 *
 * ## Flujo inicial
 * 1. `getInitialDirectory()` lee `localStorage.direction` (última carpeta visitada).
 * 2. `fsCache.init(archs)` intenta cargar árbol real de Go (profundidad 3).
 *    - Si Go está vivo, `rootDir` se actualiza al árbol real.
 *    - Si falla, se queda con `archs` mock (modo web).
 * 3. `directory` se sincroniza con el `rootDir` si el path guardado no existe en el nuevo árbol.
 *
 * ## Ejemplo de navegación real
 * ```ts
 * // Usuario hace doble clic en "/src"
 * chooseDirectory("/src") // -> fileService.listDir("/src") -> Go -> setDirectory
 *
 * // Usuario abre "/src/App.tsx"
 * chooseFile("/src/App.tsx") // -> fileService.readFile() -> Go -> setCurrentFile
 * ```
 */

import { createEffect, createSignal, onMount, Show } from "solid-js";
import styles from "./styles/app.module.css";
import { archs as mockArchs } from "./cache/file";
import FileVisualizer from "./components/visualizer/fileVisualizer";
import { Explorer } from "./components/explorer";
import Sidebar from "./components/sidebar";
import { fileService } from "./services/fileService";
import { fsCache } from "./cache/fsCache";
import { Directory, Fille } from "./types/cache";
import { ChooseDirectoryOfEnter } from "./components/chooseDirectoryOfEnter";
import { storageService } from "./services/storageSerivce";
import { OpenedFiles } from "./components/openedFiles";
import type { OpenedFile } from "./types/storage";

function App() {
  // Raíz del filesystem: inicia como mock, luego se reemplaza por árbol real de Go
  const [rootDir, setRootDir] = createSignal<Directory>(mockArchs);
  const [isRealFs, setIsRealFs] = createSignal(false);

  const getInitialDirectory = (): Directory => {
    try {
      const st = storageService.directionsDir.getDirection() ?? mockArchs.path;
      return fileService.getDirectoryByPath(st, mockArchs) ?? mockArchs;
    } catch {
      return mockArchs;
    }
  };

  const initialDir = getInitialDirectory();
  const [directory, setDirectory] = createSignal<Directory>(initialDir);
  const [parent, setParent] = createSignal<Directory | null>(
    fileService.getParentByPath(initialDir.path, mockArchs)
  );
  const [currentFile, setCurrentFile] = createSignal<Fille | null>(null);
  const [openChoose, setOpenChoose] = createSignal(false);
  const [openPanel, setOpenPanel] = createSignal(true);
  const [loadingRoot, setLoadingRoot] = createSignal(false);

  // Carga inicial desde Go (si está disponible)
  onMount(async () => {
    setLoadingRoot(true);
    try {
      const realRoot = await fsCache.init(mockArchs, ".");
      setRootDir(realRoot);
      setIsRealFs(fsCache.isReal);
      // Si el directorio inicial no existe en el árbol real, caer a root real
      const savedPath = storageService.directionsDir.getDirection() ?? realRoot.path;
      const found = fileService.getDirectoryByPath(savedPath, realRoot);
      if (found) {
        setDirectory(found);
        setParent(fileService.getParentByPath(found.path, realRoot));
      } else {
        setDirectory(realRoot);
        setParent(null);
      }
      console.log(`[App] FS init: ${fsCache.isReal ? "real (Go)" : "mock"}`);
    } catch (e) {
      console.warn("[App] fsCache.init failed, staying on mock:", e);
    } finally {
      setLoadingRoot(false);
    }
  });

  const getInitialOpenedFiles = (): OpenedFile[] => {
    try {
      const raw = storageService.filesOpen.file.getFiles();
      const seen = new Set<string>();
      const filtered = raw.filter((f) => {
        if (!f.path || !f.path.trim()) return false;
        if (seen.has(f.path)) return false;
        seen.add(f.path);
        return fileService.getFileByPath(f.path) !== null;
      });
      if (filtered.length !== raw.length) {
        try {
          storageService.filesOpen.path.setFiles(filtered.map((f) => f.path).join(":"));
        } catch {}
      }
      return filtered;
    } catch {
      return [];
    }
  };

  const [openedFiles, setOpenedFiles] = createSignal<OpenedFile[]>(getInitialOpenedFiles());

  // Mantener `parent` sincronizado con `directory` y `rootDir`
  createEffect(() => {
    // Access signals to track
    const dir = directory();
    const root = rootDir();
    setParent(fileService.getParentByPath(dir.path, root));
  });

  const addToOpened = (filePath: string) => {
    try {
      if (storageService.filesOpen.path.fileExist(filePath)) return;
    } catch {}
    try {
      storageService.filesOpen.path.setNewFile(filePath);
    } catch {}
    try {
      const next = storageService.filesOpen.file.getFiles();
      const dedup = Array.from(new Map(next.map((f) => [f.path, f])).values());
      setOpenedFiles(dedup);
    } catch {
      setOpenedFiles((prev) => {
        if (prev.some((f) => f.path === filePath)) return prev;
        return [...prev, { path: filePath, name: filePath.split("/").pop() ?? filePath }];
      });
    }
  };

  const removeFromOpened = (filePath: string) => {
    const remaining = openedFiles().filter((f) => f.path !== filePath);
    try {
      storageService.filesOpen.path.removeFile(filePath);
    } catch {}
    setOpenedFiles(remaining);
    if (currentFile()?.path === filePath) {
      if (remaining.length === 0) {
        setCurrentFile(null);
      } else {
        const last = remaining[remaining.length - 1];
        // Intentar cargar el último archivo (primero mock, luego real si es necesario)
        const file = fileService.getFileByPath(last.path);
        setCurrentFile(file ?? null);
        // Si no estaba en mock, intentar fetch real async
        if (!file) {
          fileService.readFile(last.path).then((real) => {
            if (real) setCurrentFile(real);
          });
        }
      }
    }
  };

  const closeAllOpened = () => {
    try {
      storageService.filesOpen.path.setFiles("");
    } catch {}
    setOpenedFiles([]);
    setCurrentFile(null);
  };

  // Al elegir un archivo: primero intenta FS real, luego mock
  const chooseFile = async (filePath: string) => {
    // Optimista: probar mock rápido
    let file = fileService.getFileByPath(filePath);
    if (file) {
      setCurrentFile(file);
      addToOpened(filePath);
      return;
    }
    // Real: Go
    try {
      const real = await fileService.readFile(filePath);
      if (real) {
        setCurrentFile(real);
        addToOpened(filePath);
        return;
      }
    } catch (e) {
      console.warn("[App] chooseFile failed:", e);
    }
  };

  // Al elegir una carpeta: intenta FS real, luego mock
  const chooseDirectory = async (dirPath: string): Promise<boolean> => {
    // Intentar real primero si estamos en modo real
    if (isRealFs()) {
      try {
        const fetched = await fileService.listDir(dirPath, rootDir());
        setDirectory(fetched);
        setCurrentFile(null);
        storageService.directionsDir.setDirection(dirPath);
        return true;
      } catch (e) {
        console.warn("[App] listDir real failed, trying mock:", e);
      }
    }

    // Fallback mock: buscar en root actual
    const dir = fileService.getDirectoryByPath(dirPath, rootDir());
    if (!dir) return false;
    setDirectory(dir);
    setCurrentFile(null);
    storageService.directionsDir.setDirection(dirPath);
    return true;
  };

  // Adapter síncrono para Explorer (que espera boolean)
  const handleChooseDirectory = (dirPath: string): boolean => {
    // Fire-and-forget async, pero retornar true optimista
    chooseDirectory(dirPath);
    return true;
  };

  const handleChooseFile = (filePath: string) => {
    chooseFile(filePath);
  };

  const chooseDir = async (path: string): Promise<boolean> => {
    const ok = await chooseDirectory(path);
    setOpenChoose(false);
    return ok;
  };

  // Wrapper síncrono para ChooseDirectoryOfEnter (que espera (path)=>boolean)
  const handleChooseDir = (path: string): boolean => {
    chooseDir(path);
    return true;
  };

  return (
    <div class={styles.app}>
      <Sidebar
        directoryName={directory().name}
        onTogglePanel={() => setOpenPanel((p) => !p)}
        onOpenChoose={() => setOpenChoose(!openChoose())}
      />

      <main class={styles.content}>
        <Show when={loadingRoot()}>
          <div style={{ padding: "0.5rem", "font-size": "0.85rem", color: "hsl(var(--muted-foreground))" }}>
            {isRealFs() ? "Cargando FS real (Go)..." : "Modo mock (web)..."}
          </div>
        </Show>
        <Show when={openPanel()}>
          <Explorer
            directory={directory()}
            parent={parent()}
            collapsed={false}
            chooseFile={handleChooseFile}
            chooseDirectory={handleChooseDirectory}
          />
        </Show>
        <div class={styles["container-main"]}>
          <OpenedFiles
            files={openedFiles()}
            activePath={currentFile()?.path ?? null}
            onSelect={handleChooseFile}
            onClose={removeFromOpened}
            onCloseAll={closeAllOpened}
          />
          <FileVisualizer file={currentFile()} />
        </div>
      </main>

      <Show when={openChoose()}>
        <ChooseDirectoryOfEnter
          directory={rootDir()}
          chooseDir={handleChooseDir}
          onCancel={() => setOpenChoose(false)}
        />
      </Show>
    </div>
  );
}

export default App;
