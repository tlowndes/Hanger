import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { RegionPicker } from "./ui/RegionPicker";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has("picker") ? <RegionPicker /> : <App />}
  </React.StrictMode>,
);
