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
        <span class={styles.fileIcon}>{open() ? (<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" fill="currentColor" viewBox="0 0 50 50">
<path d="M 3 4 C 1.355469 4 0 5.355469 0 7 L 0 43.90625 C -0.0625 44.136719 -0.0390625 44.378906 0.0625 44.59375 C 0.34375 45.957031 1.5625 47 3 47 L 42 47 C 43.492188 47 44.71875 45.875 44.9375 44.4375 C 44.945313 44.375 44.964844 44.3125 44.96875 44.25 C 44.96875 44.230469 44.96875 44.207031 44.96875 44.1875 L 45 44.03125 C 45 44.019531 45 44.011719 45 44 L 49.96875 17.1875 L 50 17.09375 L 50 17 C 50 15.355469 48.644531 14 47 14 L 47 11 C 47 9.355469 45.644531 8 44 8 L 18.03125 8 C 18.035156 8.003906 18.023438 8 18 8 C 17.96875 7.976563 17.878906 7.902344 17.71875 7.71875 C 17.472656 7.4375 17.1875 6.96875 16.875 6.46875 C 16.5625 5.96875 16.226563 5.4375 15.8125 4.96875 C 15.398438 4.5 14.820313 4 14 4 Z M 3 6 L 14 6 C 13.9375 6 14.066406 6 14.3125 6.28125 C 14.558594 6.5625 14.84375 7.03125 15.15625 7.53125 C 15.46875 8.03125 15.8125 8.5625 16.21875 9.03125 C 16.625 9.5 17.179688 10 18 10 L 44 10 C 44.5625 10 45 10.4375 45 11 L 45 14 L 8 14 C 6.425781 14 5.171875 15.265625 5.0625 16.8125 L 5.03125 16.8125 L 5 17 L 2 33.1875 L 2 7 C 2 6.4375 2.4375 6 3 6 Z M 8 16 L 47 16 C 47.5625 16 48 16.4375 48 17 L 43.09375 43.53125 L 43.0625 43.59375 C 43.050781 43.632813 43.039063 43.675781 43.03125 43.71875 C 43.019531 43.757813 43.007813 43.800781 43 43.84375 C 43 43.863281 43 43.886719 43 43.90625 C 43 43.917969 43 43.925781 43 43.9375 C 42.984375 43.988281 42.976563 44.039063 42.96875 44.09375 C 42.964844 44.125 42.972656 44.15625 42.96875 44.1875 C 42.964844 44.230469 42.964844 44.269531 42.96875 44.3125 C 42.84375 44.71875 42.457031 45 42 45 L 3 45 C 2.4375 45 2 44.5625 2 44 L 6.96875 17.1875 L 7 17.09375 L 7 17 C 7 16.4375 7.4375 16 8 16 Z"></path>
</svg>) : (<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"  fill="currentColor" viewBox="0 0 50 50">
<path d="M 5 4 C 3.3544268 4 2 5.3555411 2 7 L 2 16 L 2 26 L 2 43 C 2 44.644459 3.3544268 46 5 46 L 45 46 C 46.645063 46 48 44.645063 48 43 L 48 26 L 48 16 L 48 11 C 48 9.3549372 46.645063 8 45 8 L 18 8 C 18.08657 8 17.96899 8.000364 17.724609 7.71875 C 17.480227 7.437136 17.179419 6.9699412 16.865234 6.46875 C 16.55105 5.9675588 16.221777 5.4327899 15.806641 4.9628906 C 15.391504 4.4929914 14.818754 4 14 4 L 5 4 z M 5 6 L 14 6 C 13.93925 6 14.06114 6.00701 14.308594 6.2871094 C 14.556051 6.5672101 14.857231 7.0324412 15.169922 7.53125 C 15.482613 8.0300588 15.806429 8.562864 16.212891 9.03125 C 16.619352 9.499636 17.178927 10 18 10 L 45 10 C 45.562937 10 46 10.437063 46 11 L 46 13.1875 C 45.685108 13.07394 45.351843 13 45 13 L 5 13 C 4.6481575 13 4.3148915 13.07394 4 13.1875 L 4 7 C 4 6.4364589 4.4355732 6 5 6 z M 5 15 L 45 15 C 45.56503 15 46 15.43497 46 16 L 46 26 L 46 43 C 46 43.562937 45.562937 44 45 44 L 5 44 C 4.4355732 44 4 43.563541 4 43 L 4 26 L 4 16 C 4 15.43497 4.4349698 15 5 15 z"></path>
</svg>)}</span>
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
                <span class={styles.fileIcon}><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" fill="currentColor" viewBox="0 0 50 50">
<path d="M 7 2 L 7 48 L 43 48 L 43 14.59375 L 42.71875 14.28125 L 30.71875 2.28125 L 30.40625 2 Z M 9 4 L 29 4 L 29 16 L 41 16 L 41 46 L 9 46 Z M 31 5.4375 L 39.5625 14 L 31 14 Z"></path>
</svg></span>
                <span>{file.name}</span>
              </button>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
