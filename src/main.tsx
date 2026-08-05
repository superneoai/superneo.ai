import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { resetInitialScroll } from "./scrollBoot";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";

resetInitialScroll(window);

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
