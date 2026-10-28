// frontend/config.js — where the CRM API lives.
// When the backend serves these pages (the normal setup, http://localhost:4000)
// it replaces this file with `apiBase: "/api/crm"`. This copy is only used if
// a page is opened some other way, e.g. an editor's preview.
window.CRM_CONFIG = {
  apiBase: "http://localhost:4000/api/crm",
};
