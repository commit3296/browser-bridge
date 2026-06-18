import React from "react";
import ReactDOM from "react-dom/client";
import "../../src/index.css";
import { PopupApp } from "../../src/ui/PopupApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
