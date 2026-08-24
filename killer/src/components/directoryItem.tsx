import { For, createSignal } from "solid-js";
import styles from "../styles/directoryItem.module.css";
import { Directory } from "../types/cache";

export type DirectoryItemProps = {
  // Lista de directorios a mostrar. La carpeta padre vive en el
  // componente que usa este (por ejemplo LeftSideabar).
  directorys: Directory[];
  chooseFile: (filePath: string) => boolean;
};

// Punto de entrada: recibe la lista y pinta un nodo por cada carpeta.
export function DirectoryItem(props: DirectoryItemProps) {
  return (
    <For each={props.directorys}>
      {(dir) => (
        <DirectoryNode directory={dir} chooseFile={props.chooseFile} />
      )}
    </For>
  );
}

// Nodo por directorio: cada uno tiene su PROPIO estado open.
// Si el estado viviera arriba, abrir una carpeta abriría todas.
function DirectoryNode(props: {
  directory: Directory;
  chooseFile: (filePath: string) => boolean;
}) {
  const [open, setOpen] = createSignal(false);

  return (
    <div>
      <button
        type="button"
        class={styles.fileItem}
        onClick={() => setOpen((value) => !value)}
      >
        <span class={styles.fileIcon}>{open() ? "📂" : "📁"}</span>
        <span>{props.directory.name}</span>
      </button>

      {open() && (
        <div style={{ "padding-left": "16px" }}>
          {/*
            Recursión: los subdirectorios vuelven a entrar como lista
            a DirectoryItem, que crea un nodo independiente por cada uno.
          */}
          <DirectoryItem
            directorys={props.directory.directorys}
            chooseFile={props.chooseFile}
          />

          {/*
            Los archivos de esta carpeta abren directamente en el visor.
          */}
          <For each={props.directory.files}>
            {(file) => (
              <button
                type="button"
                class={styles.fileItem}
                onClick={() => props.chooseFile(file.path)}
              >
                <span class={styles.fileIcon}>📄</span>
                <span>{file.name}</span>
              </button>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
