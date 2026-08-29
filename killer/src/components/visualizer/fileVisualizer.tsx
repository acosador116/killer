import { createEffect } from "solid-js";
import styles from "../../styles/fileVisualizer.module.css";
import { Fille } from "../../types/cache";
import { storageService } from "../../services/storageSerivce";
import { fileService } from "../../services/fileService";

interface Props {
  file: Fille | null;
}

export default function FileVisualizer(props: Props) {
  createEffect(() => {
    if(!props.file) return 

    if(storageService.filesOpen.path.fileExist(props.file.path)) return 
    
    storageService.filesOpen.path.setNewFile(props.file.path)
  })
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