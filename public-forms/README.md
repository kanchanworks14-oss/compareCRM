# Compare Projects — public enquiry forms

A small public website, separate from the CRM dashboard (`../frontend`). Visitors
send enquiries without logging in; every enquiry is saved by the CRM backend
(`../backend`) and appears in the CRM dashboard.

**One link for all three forms: `/forms/`.** Tabs switch between them, and
`?form=` opens a specific one, so each form can still be shared directly.

| Link | Form | Saves to CRM via | CRM section |
|---|---|---|---|
| `/forms/` or `/forms/?form=customer` | Customer enquiry (default) | `POST /api/crm/public/customer` | Customer Leads |
| `/forms/?form=developer` | Developer project submission | `POST /api/crm/public/developer` | Developer Leads |
| `/forms/?form=agent` | Agent property submission | `POST /api/crm/public/agent` | Agent Leads |

The backend also accepts the old `POST /api/crm/public/broker` as an alias of `/agent` (it saves `agent`).

Older links redirect to the right tab and keep their query string:
`/forms/customer/`, `/forms/developer/`, `/forms/agent/`, `/customer.html`, `/developer.html`,
`/agent.html`, `/broker.html` (→ Agent).

The customer form pre-fills **Property / project of interest** from `?propertyTitle=` and sends
`?propertyId=` with the enquiry, e.g. `/forms/?form=customer&propertyId=665f…&propertyTitle=Sea%20View`.
Switching tabs keeps what the visitor has already typed.

## Commands

```powershell
npm install      # first time only
npm run dev      # http://localhost:5174/forms/  (API calls go to the CRM backend on :4000)
npm run build    # writes ../frontend/forms/ and the redirect pages for older links
```

`npm run build` empties and rewrites `../frontend/forms/` only — that folder belongs to
this project. The CRM dashboard build (`../frontend`, `npm run build`) never touches it.
The CRM backend (`backend/server.js`) already serves `frontend/` as static files, so no
backend change is needed. Commit the build output, as with the dashboard.

## Security

- No secrets in this code: the `/api/crm/public/*` endpoints need no login, cookie or key.
- The backend validates every field again, rate-limits per IP (5 per 10 minutes), ignores
  honeypot submissions and treats a repeat of the same enquiry within 24 hours as a duplicate.
- `VITE_API_BASE` (optional, default `/api/crm`) is only needed if this site is ever hosted on
  a different domain from the CRM backend; that also requires adding the site to the
  backend's `CORS_ORIGINS`.

## Structure

```
index.html               the page entry
src/main.jsx             renders FormsPage
src/pages/FormsPage.jsx  tabs, ?form= handling, the three forms
src/components/          SiteHeader, SiteFooter, PageShell, EnquiryForm, Field, Icons
src/forms/               customerForm, developerForm, agentForm (fields match backend validation)
src/lib/                 api.js (submit), query.js (propertyId / propertyTitle)
src/styles/site.css
```
