import { For, Show, createSignal, createEffect } from "solid-js";
import { Directory } from "../types/cache";
import styles from "../styles/chooseDir.module.css";
import { fileService } from "../services/fileService";

interface Props {
  chooseDir: (path: string) => boolean;
  onCancel?: () => void;
  directory: Directory;
}

/**
 * Diálogo de selección de directorio con navegación tipo Explorer.
 *
 * - Muestra solo la carpeta actual + fila "..." para subir (no lista padres raíz).
 * - Doble clic entra a la carpeta (intenta fetch real via fileService si el FS es Go).
 * - Header clickeable selecciona la carpeta actual.
 *
 * Arquitectura:
 * ```ts
 * ChooseDirectoryOfEnter
 *  ├─ currentDir (signal) ──> rendered fileList
 *  ├─ history stack ──> navigateUp pop
 *  └─ navigateInto ──> fileService.listDir (real) || dir (mock)
 * ```
 */
export function ChooseDirectoryOfEnter(props: Props) {
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [currentDir, setCurrentDir] = createSignal<Directory>(props.directory);
  // Stack para navegación atrás sin depender del árbol completo (útil para FS real profundo)
  const [history, setHistory] = createSignal<Directory[]>([]);

  createEffect(() => {
    setCurrentDir(props.directory);
    setHistory([]);
  });

  const parent = () => {
    // Primero intentar con stack (más fiable para FS real)
    const h = history();
    if (h.length > 0) return h[h.length - 1];
    // Fallback a búsqueda en el árbol recibido
    return fileService.getParentByPath(currentDir().path, props.directory);
  };

  const navigateInto = async (dir: Directory) => {
    // Intentar cargar la versión fresca desde Go (si está disponible)
    // Así obtenemos hijos reales aunque el árbol mock estuviera vacío
    try {
      const fetched = await fileService.listDir(dir.path, props.directory);
      // Si fetched tiene hijos, es más completo que el dir del mock
      setHistory([...history(), currentDir()]);
      setCurrentDir(fetched);
      return;
    } catch {
      // Fallback: usar el objeto dir que ya tenemos
    }
    setHistory([...history(), currentDir()]);
    setCurrentDir(dir);
  };

  const navigateUp = () => {
    const h = history();
    if (h.length > 0) {
      const prev = h[h.length - 1];
      setHistory(h.slice(0, -1));
      setCurrentDir(prev);
      return;
    }
    const p = parent();
    if (p) setCurrentDir(p);
  };

  const confirm = () => {
    const path = selectedPath();
    if (!path) return;
    props.chooseDir(path);
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

      <div class={styles.header}>
        <button
          type="button"
          class={styles.headerTitle}
          classList={{ [styles.selected]: selectedPath() === currentDir().path }}
          onClick={() => setSelectedPath(currentDir().path)}
          title={currentDir().path}
        >
          {currentDir().name}
        </button>
      </div>

      <div class={`${styles.explorer} scroll-hover`}>
        <Show when={parent()}>
          <button
            type="button"
            class={styles.upRow}
            onClick={navigateUp}
            title="Subir un nivel"
          >
            <span class={styles.upIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" fill="currentColor" viewBox="0 0 50 50">
                <path d="M 5 4 C 3.3544268 4 2 5.3555411 2 7 L 2 16 L 2 26 L 2 43 C 2 44.644459 3.3544268 46 5 46 L 45 46 C 46.645063 46 48 44.645063 48 43 L 48 26 L 48 16 L 48 11 C 48 9.3549372 46.645063 8 45 8 L 18 8 C 18.08657 8 17.96899 8.000364 17.724609 7.71875 C 17.480227 7.437136 17.179419 6.9699412 16.865234 6.46875 C 16.55105 5.9675588 16.221777 5.4327899 15.806641 4.9628906 C 15.391504 4.4929914 14.818754 4 14 4 L 5 4 z M 5 6 L 14 6 C 13.93925 6 14.06114 6.00701 14.308594 6.2871094 C 14.556051 6.5672101 14.857231 7.0324412 15.169922 7.53125 C 15.482613 8.0300588 15.806429 8.562864 16.212891 9.03125 C 16.619352 9.499636 17.178927 10 18 10 L 45 10 C 45.562937 10 46 10.437063 46 11 L 46 13.1875 C 45.685108 13.07394 45.351843 13 45 13 L 5 13 C 4.6481575 13 4.3148915 13.07394 4 13.1875 L 4 7 C 4 6.4364589 4.4355732 6 5 6 z M 5 15 L 45 15 C 45.56503 15 46 15.43497 46 16 L 46 26 L 46 43 C 46 43.562937 45.562937 44 45 44 L 5 44 C 4.4355732 44 4 43.563541 4 43 L 4 26 L 4 16 C 4 15.43497 4.4349698 15 5 15 z"></path>
              </svg>
            </span>
            <span>...</span>
          </button>
        </Show>

        <For each={currentDir().directorys}>
          {(dir) => (
            <button
              type="button"
              class={styles["file-item"]}
              classList={{ [styles.selected]: selectedPath() === dir.path }}
              onClick={() => setSelectedPath(dir.path)}
              onDblClick={() => navigateInto(dir)}
              title={`${dir.path} — doble clic para entrar`}
            >
              <span>{dir.name}</span>
              <span class={styles.fileIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" fill="currentColor" viewBox="0 0 50 50">
                  <path d="M 5 4 C 3.3544268 4 2 5.3555411 2 7 L 2 16 L 2 26 L 2 43 C 2 44.644459 3.3544268 46 5 46 L 45 46 C 46.645063 46 48 44.645063 48 43 L 48 26 L 48 16 L 48 11 C 48 9.3549372 46.645063 8 45 8 L 18 8 C 18.08657 8 17.96899 8.000364 17.724609 7.71875 C 17.480227 7.437136 17.179419 6.9699412 16.865234 6.46875 C 16.55105 5.9675588 16.221777 5.4327899 15.806641 4.9628906 C 15.391504 4.4929914 14.818754 4 14 4 L 5 4 z M 5 6 L 14 6 C 13.93925 6 14.06114 6.00701 14.308594 6.2871094 C 14.556051 6.5672101 14.857231 7.0324412 15.169922 7.53125 C 15.482613 8.0300588 15.806429 8.562864 16.212891 9.03125 C 16.619352 9.499636 17.178927 10 18 10 L 45 10 C 45.562937 10 46 10.437063 46 11 L 46 13.1875 C 45.685108 13.07394 45.351843 13 45 13 L 5 13 C 4.6481575 13 4.3148915 13.07394 4 13.1875 L 4 7 C 4 6.4364589 4.4355732 6 5 6 z M 5 15 L 45 15 C 45.56503 15 46 15.43497 46 16 L 46 26 L 46 43 C 46 43.562937 45.562937 44 45 44 L 5 44 C 4.4355732 44 4 43.563541 4 43 L 4 26 L 4 16 C 4 15.43497 4.4349698 15 5 15 z"></path>
                </svg>
              </span>
            </button>
          )}
        </For>

        <Show when={currentDir().directorys.length === 0}>
          <p class={styles.emptyMsg}>Sin subcarpetas</p>
        </Show>
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
