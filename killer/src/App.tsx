
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

let st = storageService.directionsDir.getDirection()
if (!st) st = archs.path
let dirss = fileService.getDirectoryByPath(st, archs)

// La aplicación principal conecta el árbol de directorios con el visor.
function App() {
  const [directory, setDirectory] = createSignal<Directory>(dirss as Directory);
  const [parent, setParent] = createSignal<Directory | null>(null);
  const [currentFile, setCurrentFile] = createSignal<Fille | null>(null);
  const [openChoose, setOpenChoose] = createSignal(false);
  const [openPanel, setOpenPanel] = createSignal(true);

  createEffect(() => {
    setParent(fileService.getParentByPath(dirss?.path as string, archs))
  })

  // Al elegir un archivo lo cargamos en el visor.
  const chooseFile = (filePath: string): boolean => {
    const file = fileService.getFileByPath(filePath);
    if (!file) return false;
    setCurrentFile(file);
    return true;
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

        <FileVisualizer file={currentFile()} />
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
