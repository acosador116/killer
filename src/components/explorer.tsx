import { Show, createSignal, onMount, onCleanup } from "solid-js";
import styles from "../styles/explorer.module.css";
import { DirectoryItem } from "./directoryItem";
import { Directory } from "../types/cache";

type Props = {
  directory: Directory;
  parent?: Directory | null;
  collapsed?: boolean;
  chooseFile: (filePath: string) => void;
  chooseDirectory: (dirPath: string) => boolean;
};

const MIN_WIDTH = 20;
const MAX_WIDTH = 1200;

export function Explorer(props: Props) {
  const [error, setError] = createSignal<null | string>(null);

  // Ancho inicial consistente con el CSS (260px).
  const [sidebarWidth, setSidebarWidth] = createSignal(260);

  let resizeHandle!: HTMLDivElement;

  const handleChooseFile = (filePath: string): boolean => {
    props.chooseFile(filePath);
    return true;
  };

  const handleChooseDirectory = (dirPath: string): boolean => {
    if (!props.chooseDirectory(dirPath)) {
      setError("Hubo un error al abrir la dirección");
      return false;
    }
    setError(null);
    return true;
  };

  // Redimensionamiento del sidebar.
  onMount(() => {
    let resizing = false;
    let startX = 0;
    let startWidth = 0;

    // En móvil no aplicamos resize (el CSS oculta el handle).
    const isMobile = () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 720px)").matches;

    const clamp = (value: number) => {
      const maxByViewport = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, window.innerWidth - 80)
      );
      return Math.min(Math.max(value, MIN_WIDTH), maxByViewport);
    };

    const stopResizing = () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isMobile()) return;
      if (event.button !== 0) return; // solo botón principal

      event.preventDefault();

      resizing = true;
      startX = event.clientX;
      startWidth = sidebarWidth();

      // Captura el puntero para no perder el drag si sale del handle.
      resizeHandle.setPointerCapture?.(event.pointerId);

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizing) return;

      const delta = event.clientX - startX;
      setSidebarWidth(clamp(startWidth + delta));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!resizing) return;
      resizeHandle.releasePointerCapture?.(event.pointerId);
      stopResizing();
    };

    const handlePointerCancel = () => {
      stopResizing();
    };

    // Si la ventana pierde foco, cancelamos el drag.
    const handleBlur = () => stopResizing();

    resizeHandle.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleBlur);

    onCleanup(() => {
      resizeHandle.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleBlur);

      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });
  });

  return (
    <>
      <aside
        class={`${styles.sidebar} scroll-hover`}
        classList={{
          [styles.collapsed]: !!props.collapsed,
        }}
        style={{
          width: `${sidebarWidth()}px`,
        }}
      >
        <div class={styles.sidebarHeader}>
          <span class={styles.title}>{props.directory.name}</span>
        </div>

        <div class={styles.fileList}>
          <Show when={props.parent}>
            {(parent) => (
              <button
                type="button"
                class={styles.upRow}
                onClick={() => handleChooseDirectory(parent().path)}
              >
                <span class={styles.upIcon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 50 50"
                  >
                    <path d="M 5 4 C 3.3544268 4 2 5.3555411 2 7 L 2 16 L 2 26 L 2 43 C 2 44.644459 3.3544268 46 5 46 L 45 46 C 46.645063 46 48 44.645063 48 43 L 48 26 L 48 16 L 48 11 C 48 9.3549372 46.645063 8 45 8 L 18 8 C 18.08657 8 17.96899 8.000364 17.724609 7.71875 C 17.480227 7.437136 17.179419 6.9699412 16.865234 6.46875 C 16.55105 5.9675588 16.221777 5.4327899 15.806641 4.9628906 C 15.391504 4.4929914 14.818754 4 14 4 L 5 4 z M 5 6 L 14 6 C 13.93925 6 14.06114 6.00701 14.308594 6.2871094 C 14.556051 6.5672101 14.857231 7.0324412 15.169922 7.53125 C 15.482613 8.0300588 15.806429 8.562864 16.212891 9.03125 C 16.619352 9.499636 17.178927 10 18 10 L 45 10 C 45.562937 10 46 10.437063 46 11 L 46 13.1875 C 45.685108 13.07394 45.351843 13 45 13 L 5 13 C 4.6481575 13 4.3148915 13.07394 4 13.1875 C 4 15.434969 4.4349698 15 5 15 z M 5 15 L 45 15 C 45.56503 15 46 15.43497 46 16 L 46 26 L 46 43 C 46 43.562937 45.562937 44 45 44 L 5 44 C 4.4355732 44 4 43.563541 4 43 L 4 26 L 4 16 C 4 15.434969 4.4349698 15 5 15 z" />
                  </svg>
                </span>
                <span>...</span>
              </button>
            )}
          </Show>

          <DirectoryItem
            directorys={props.directory.directorys}
            chooseFile={handleChooseFile}
          />
        </div>

        <Show when={error()}>
          <p class={styles.error}>{error()}</p>
        </Show>
      </aside>

      {/* Zona para redimensionar */}
      <div
        ref={resizeHandle}
        class={styles.resizeLove}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar explorador"
      />
    </>
  );
}