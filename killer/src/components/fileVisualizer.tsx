import styles from "../styles/fileVisualizer.module.css";
import { Fille } from "../types/cache";

interface Props {
  file: Fille | null;
}

export default function FileVisualizer(props: Props) {
  return (
    <section class={styles.viewer}>
      {props.file && (
        <>
          <div class={styles.viewerHeader}>
            <span class={styles.viewerBadge}>archivo</span>
            <h2>{props.file.name}</h2>
          </div>
          <pre class={`${styles.codeBlock} scroll-hover`}>{props.file.data}</pre>
        </>
      )}
    </section>
  );
}