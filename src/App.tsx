
import { createEffect, createSignal, Show } from "solid-js";
import styles from "./styles/app.module.css";
import { archs } from "./cache/file";
import FileVisualizer from "./components/visualizer/fileVisualizer";
import { Explorer } from "./components/explorer";
import Sidebar from "./components/sidebar";
import { fileService } from "./services/fileService";
import { Directory, Fille } from "./types/cache";
import { ChooseDirectoryOfEnter } from "./components/chooseDirectoryOfEnter";
import { storageService } from "./services/storageSerivce";
import { OpenedFiles } from "./components/openedFiles";
import type { OpenedFile } from "./types/storage";

// La aplicación principal conecta el árbol de directorios con el visor.
function App() {
  // Inicialización segura dentro del componente: si el path guardado no existe,
  // caemos a la raíz (archs) para evitar `directory()` === null y pantallas en blanco.
  const getInitialDirectory = (): Directory => {
    try {
      const st = storageService.directionsDir.getDirection() ?? archs.path;
      return fileService.getDirectoryByPath(st, archs) ?? archs;
    } catch {
      return archs;
    }
  };

  const initialDir = getInitialDirectory();
  const [directory, setDirectory] = createSignal<Directory>(initialDir);
  const [parent, setParent] = createSignal<Directory | null>(
    fileService.getParentByPath(initialDir.path, archs)
  );
  const [currentFile, setCurrentFile] = createSignal<Fille | null>(null);
  const [openChoose, setOpenChoose] = createSignal(false);
  const [openPanel, setOpenPanel] = createSignal(true);

  // --- Sistema de archivos abiertos (reactivo, sin rediseñar service) ---
  // Carga inicial tolerante: filtra vacíos, duplicados y rutas que ya no existen.
  const getInitialOpenedFiles = (): OpenedFile[] => {
    try {
      const raw = storageService.filesOpen.file.getFiles();
      const seen = new Set<string>();
      const filtered = raw.filter((f) => {
        if (!f.path || !f.path.trim()) return false;
        if (seen.has(f.path)) return false;
        seen.add(f.path);
        // Si el archivo ya no existe en el cache, lo descartamos (evita tabs fantasmas)
        return fileService.getFileByPath(f.path) !== null;
      });
      // Si filtramos algo, re-sincronizamos storage para no dejar basura
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

  createEffect(() => {
    setParent(fileService.getParentByPath(directory().path, archs));
  })

  const addToOpened = (filePath: string) => {
    // No duplicar: si ya está, no tocar storage ni señal (mantiene orden de apertura)
    try {
      if (storageService.filesOpen.path.fileExist(filePath)) return;
    } catch {}
    try {
      storageService.filesOpen.path.setNewFile(filePath);
    } catch {}
    // Actualizamos señal local a partir de storage (fuente de verdad sigue siendo el service)
    try {
      const next = storageService.filesOpen.file.getFiles();
      // Filtro defensivo por si storage quedó corrupto
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
    // Si cerramos el archivo visible, mostramos el último abierto o vacío
    if (currentFile()?.path === filePath) {
      if (remaining.length === 0) {
        setCurrentFile(null);
      } else {
        const last = remaining[remaining.length - 1];
        const file = fileService.getFileByPath(last.path);
        setCurrentFile(file ?? null);
      }
    }
  };

  const closeAllOpened = () => {
    try {
      // Vaciamos storage: setFiles con "" deja getFilesList() -> null -> [] , consistente
      storageService.filesOpen.path.setFiles("");
    } catch {}
    setOpenedFiles([]);
    setCurrentFile(null);
  };

  // Al elegir un archivo lo cargamos en el visor y lo registramos como abierto.
  const chooseFile = (filePath: string) => {
    const file = fileService.getFileByPath(filePath);
    if (!file) return;
    setCurrentFile(file);
    addToOpened(filePath);
    return;
  };

  // Al elegir una carpeta navegamos dentro de ella y reiniciamos el visor.
  const chooseDirectory = (dirPath: string): boolean => {
    const dir = fileService.getDirectoryByPath(dirPath, archs);
    if (!dir) return false;
    setDirectory(dir);
    setParent(fileService.getParentByPath(dirPath, archs));
    setCurrentFile(null);
    storageService.directionsDir.setDirection(dirPath);
    return true;
  };

  // El diálogo de selección de carpeta raíz cierra tras confirmar.
  const chooseDir = (path: string): boolean => {
    const ok = chooseDirectory(path);
    setOpenChoose(false);
    return ok;
  };

  return (
    <div class={styles.app}>
      <Sidebar
        directoryName={directory().name}
        onTogglePanel={() => setOpenPanel((p) => !p)}
        onOpenChoose={() => setOpenChoose(!openChoose())}
      />

      <main class={styles.content}>
        <Show when={openPanel()}>
          <Explorer
            directory={directory()}
            parent={parent()}
            collapsed={false}
            chooseFile={chooseFile}
            chooseDirectory={chooseDirectory}
          />
        </Show>
        <div class={styles["container-main"]}>
          <OpenedFiles
            files={openedFiles()}
            activePath={currentFile()?.path ?? null}
            onSelect={chooseFile}
            onClose={removeFromOpened}
            onCloseAll={closeAllOpened}
          />
          <FileVisualizer file={currentFile()} />
        </div>
        
      </main>

      <Show when={openChoose()}>
        <ChooseDirectoryOfEnter
          directory={archs}
          chooseDir={chooseDir}
          onCancel={() => setOpenChoose(false)}
        />
      </Show>
    </div>
  );
}

export default App;
