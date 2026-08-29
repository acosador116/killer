import { createSignal, createEffect, onCleanup } from "solid-js";
import { useTheme, themes, type ThemeName } from "../contexts/ThemeContext";
import styles from "../styles/themeToggleSidebar.module.css";

const previewMap: Record<ThemeName, string> = {
  light: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
  dark: "linear-gradient(135deg, #334155, #020617)",
  ocean: "linear-gradient(135deg, #38bdf8, #06b6d4)",
  coffee: "linear-gradient(135deg, #f59e0b, #ea580c)",
  forest: "linear-gradient(135deg, #22c55e, #15803d)",
  sakura: "hotpink",
  sunset: "linear-gradient(135deg, #a855f7, #ec4899)",
  
};

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
