import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/base.css";
import "./styles/library.css";
import "./styles/replay.css";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Missing app root");
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import "./styles/insights.css";

import "./styles/analytics.css";
import "./styles/themes.css";
