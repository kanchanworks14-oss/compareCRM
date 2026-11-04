// app/src/main.jsx — entry for the CRM dashboard (login-protected, HashRouter).
// Public enquiry forms are a separate site: see ../../../public-forms/.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
