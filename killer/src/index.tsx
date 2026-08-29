/* @refresh reload */
import { render } from "solid-js/web";
import "./global.css";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";

render(
  () => (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  ),
  document.getElementById("root") as HTMLElement,
);
