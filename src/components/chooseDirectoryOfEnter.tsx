import { For, createSignal } from "solid-js";
import { Directory } from "../types/cache";
import styles from "../styles/chooseDir.module.css";

interface Props {
  chooseDir: (path: string) => boolean;
  // Permite cerrar el diálogo sin elegir nada (botón ✕).
  onCancel?: () => void;
  directory: Directory;
}

// Propiedades del nodo recursivo. selectedPath llega como accessor
// (no destructurado a string) para que el resaltado sea reactivo.
interface NodeProps {
  directory: Directory;
  selectedPath: () => string | null;
  onSelect: (path: string) => void;
}

// DirectoryNode solo pinta la carpeta y sus hijas; no confirma nada.
// La selección sube con onSelect hasta la raíz, que es quien decide.
function DirectoryNode(props: NodeProps) {
  const [open, setOpen] = createSignal(false);

  // Elegir una carpeta también la expande para poder seguir bajando.
  const select = () => {
    props.onSelect(props.directory.path);
  };

  return (
    <div>
      <button
        type="button"
        class={styles["file-item"]}
        classList={{ [styles.selected]: props.selectedPath() === props.directory.path }}
        onClick={select}
        ondblclick={() => setOpen(!open())}
      >
        {props.directory.name}
        <span class={styles.fileIcon}>{open() ? "📂" : "📁"}</span>
      </button>

      {open() && (
        <div style={{ "margin-left": "16px" }}>
          <For each={props.directory.directorys}>
            {(dir) => (
              <DirectoryNode
                directory={dir}
                selectedPath={props.selectedPath}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
}

export function ChooseDirectoryOfEnter(props: Props) {
  // selectedPath vive SOLO en la raíz: hay un único origen de verdad
  // y un único botón de confirmación, sin importar la profundidad.
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);

  const confirm = () => {
    const path = selectedPath();
    if(!path) return

    props.chooseDir(path)
  };

  return (
    <div class={styles["container-explorer"]}>
      {props.onCancel && (
        <button
          type="button"
          class={styles["close-btn"]}
          title="Cerrar"
          onClick={() => props.onCancel?.()}
        >
          ✕
        </button>
      )}

      <div class={`${styles.explorer} scroll-hover`}>
        <DirectoryNode
          directory={props.directory}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
        />
      </div>

      <button
        type="button"
        class={styles["confirm-btn"]}
        disabled={!selectedPath()}
        onClick={confirm}
      >
        That
      </button>
    </div>
  );
}
