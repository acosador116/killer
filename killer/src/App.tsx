
import { createSignal } from "solid-js";
import styles from "./styles/app.module.css";
import { archs } from "./cache/file";
import FileVisualizer from "./components/fileVisualizer";
import { LeftSideabar } from "./components/leftSidebar";
import { fileService } from "./services/fileService";
import { Directory, Fille } from "./types/cache";
import { ChooseDirectoryOfEnter } from "./components/chooseDirectoryOfEnter";

// La aplicación principal conecta el árbol de directorios con el visor.
function App() {
  // fileUse guarda el archivo actualmente seleccionado para visualización.
  const [fileUse, setFileUse] = createSignal<Fille | null>(null);
  // directory es la carpeta que muestra el explorador izquierdo.
  // Arranca en "src"; si no existiera, cae a la raíz del árbol.
  const [directory, setDirectory] = createSignal<Directory>(archs);

  const [open, setOpen] = createSignal<boolean>(true);

  // chooseFile se usa al hacer doble click en un archivo.
  // Este setter debe producir un valor nuevo para que Solid vuelva a renderizar.
  const chooseFile = (path: string): boolean => {
    const nextFile = fileService.getFileByPath(path);

    if (!nextFile) {
      setFileUse(null);
      return false;
    }

    setFileUse({ ...nextFile });
    return true;
  };

  // chooseDirectory cambia la carpeta raíz del explorador izquierdo.
  // Mismo patrón que chooseFile: false si la ruta no existe, sin lanzar
  // excepciones (un throw vacío rompía la app sin ningún mensaje).
  const chooseDirectory = (path: string): boolean => {

    const nextDirectory = fileService.getDirectoryByPath(path, archs);

    if (!nextDirectory) {
      return false;
    }

    setDirectory(nextDirectory);
    setOpen(false)
    return true;
  };

  // Carpeta contenedora de la actual; null en la raíz.
  // Se recalcula sola cuando cambia `directory`.
  const parentDirectory = () => fileService.getParentByPath(directory().path, archs);

  return (
    <main class={styles["app"]}>
      <LeftSideabar
        directory={directory()}
        parent={parentDirectory()}
        chooseFile={chooseFile}
        chooseDirectory={chooseDirectory}
      />
      <FileVisualizer file={fileUse()} />
      {open() && <ChooseDirectoryOfEnter chooseDir={chooseDirectory} directory={archs} />}
    </main>
  );
}

export default App;
