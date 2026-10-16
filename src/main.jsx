import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import KesemApp from "./kesem/KesemApp";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <KesemApp userId={null} onExit={() => {}} />
  </StrictMode>
);
