import React from "react";
import ReactDOM from "react-dom/client";
import "../../src/index.css";
import { SidePanelApp } from "../../src/ui/SidePanelApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);
