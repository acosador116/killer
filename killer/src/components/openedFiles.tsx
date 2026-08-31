import { type OpenedFile } from "../types/storage.ts"
import styles from "../styles/openedFiles.module.css"
import { For, Show } from "solid-js";

interface Props {
  files: OpenedFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseAll: () => void;
}

// Presentacional y 100% reactivo a props: no tiene señal interna ni toca storage.
// Toda la mutación pasa por App.tsx -> storageService (tu lógica intacta).
export function OpenedFiles(props: Props) {
  return (
    <main class={styles["main"]}>
      <Show when={props.files.length > 0} fallback={null}>
        <For each={props.files}>
          {(file) => {
            const isActive = () => props.activePath === file.path;
            return (
              <div
                class={styles["openedFile"]}
                classList={{ [styles["active"]]: isActive() }}
                title={file.path}
              >
                <button
                  type="button"
                  onClick={() => props.onSelect(file.path)}
                  class={styles["openFile"]}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  class={styles["closeBtn"]}
                  title="Cerrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onClose(file.path);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          }}
        </For>
      </Show>
    </main>
  );
}