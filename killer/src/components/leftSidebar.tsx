import { Show, createSignal } from "solid-js";
import styles from "../styles/leftSidebar.module.css";
import { DirectoryItem } from "./directoryItem";
import { Directory } from "../types/cache";

// Propiedades que recibe el componente principal del explorador.
type Props = {
  directory: Directory;
  // Carpeta contenedora de `directory`, si existe. Con ella se pinta
  // la fila "..." para subir un nivel.
  parent?: Directory | null;
  // Plegado horizontal del panel (lo controla el botón ☰ de App).
  collapsed?: boolean;
  chooseFile: (filePath: string) => boolean;
  chooseDirectory: (dirPath: string) => boolean;
};

export function LeftSideabar(props: Props) {
  // Error local para avisar si falla la apertura de un archivo.
  const [error, setError] = createSignal<null | string>(null);

  // Envuelve la función recibida para agregar manejo de errores.
  // Debe devolver exactamente boolean porque DirectoryItem espera esa firma.
  const handleChooseFile = (filePath: string): boolean => {
    const trust = props.chooseFile(filePath);

    if (!trust) {
      setError("Hubo un error al abrir la dirección");
      return false;
    }

    return true;
  };

  const handleChooseDirectory = (dirPath: string): boolean => {
    if (!props.chooseDirectory(dirPath)) {
      setError("Hubo un error al abrir la dirección");
      return false;
    }

    return true;
  };

  return (
    <aside
      class={`${styles.sidebar} scroll-hover`}
      classList={{ [styles.collapsed]: !!props.collapsed }}
    >
      <div class={styles.sidebarHeader}>
        📁
        <span class={styles["title"]}>{props.directory.name} </span>
      </div>

      <div class={styles.fileList}>
        {/*
          Fila "..." para volver a la carpeta contenedora.
          En la raíz no hay padre, así que no se muestra.
        */}
        <Show when={props.parent}>
          {(parent) => (
            <button
              type="button"
              class={styles.upRow}
              onClick={() => handleChooseDirectory(parent().path)}
            >
              <span class={styles.upIcon}>📁</span>
              <span>...</span>
            </button>
          )}
        </Show>

        {/*
          Empezamos por la raíz del árbol. Desde aquí, DirectoryItem se encarga
          de renderizar subdirectorios y archivos de forma automática.
        */}
        <DirectoryItem
          directorys={props.directory.directorys}
          chooseFile={handleChooseFile}
        />
      </div>

      {error() && <p class={styles.error}>{error()}</p>}
    </aside>
  );
}
