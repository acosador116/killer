import styles from "../../styles/fileVisualizer.module.css";
import { Fille } from "../../types/cache";

interface Props {
  file: Fille | null;
}

// Componente puro: solo visualiza, no toca storage.
// La gestión de "abiertos" vive en App.tsx para mantener una única fuente de verdad.
export default function FileVisualizer(props: Props) {
  return (
    <section class={styles.viewer}>
      {props.file && (
        <pre class={`${styles.codeBlock} scroll-hover`}>{props.file.data}</pre>
      ) }
    </section>
  );
}