import { createSignal, createEffect, onCleanup } from "solid-js";
import { useTheme, themes } from "../contexts/ThemeContext";
import styles from "../styles/themeToggleSidebar.module.css";

export function ThemeToggleSidebar() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const close = () => setOpen(false);

  const onClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) close();
  };

  createEffect(() => {
    if (open()) {
      document.addEventListener("click", onClickOutside);
    } else {
      document.removeEventListener("click", onClickOutside);
    }
  });
  onCleanup(() => document.removeEventListener("click", onClickOutside));

  return (
    <div class={styles.container} ref={ref}>
      <button
        type="button"
        class={`${styles.themeToggle} ${styles.themeToggleCollapsed}`}
        classList={{ [styles.open]: open() }}
        title="Cambiar tema"
        onClick={() => setOpen((o) => !o)}
      >
        <img width="49" height="49" src="https://img.icons8.com/external-prettycons-lineal-color-prettycons/49/external-mars-space-prettycons-lineal-color-prettycons.png" alt="external-mars-space-prettycons-lineal-color-prettycons"/>
      </button>

      {open() && (
        <div class={styles.dropdown}>
          <div class={styles.dropdownHeader}>Temas</div>
          <div class={styles.dropdownList}>
            {themes.map((t) => {
              const active = theme() === t.name;
              return (
                <button
                  type="button"
                  class={`${styles.dropdownItem} ${
                    active ? styles.activeItem : ""
                  }`}
                  onClick={() => {
                    setTheme(t.name);
                    close();
                  }}
                >
                  <div
                    class={styles.previewSmall}
                    style={{ "background": t.preview }}
                  />
                  <span class={styles.itemLabel}>{t.label}</span>
                  {active && <span class={styles.check}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeToggleSidebar;
