// public-forms/src/main.jsx — entry for the single public page, /forms/.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FormsPage from "./pages/FormsPage.jsx";
import "./styles/site.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FormsPage />
  </StrictMode>,
);
