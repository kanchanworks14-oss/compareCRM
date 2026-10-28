# Compare Projects CRM

A lead-management CRM for property enquiries. It includes:
- three public forms: Customer, Developer and Agent/Broker;
- a role-based dashboard for Super Admins, Sales Managers and Sales Representatives.

| Folder | What it is |
|---|---|
| `backend/` | Node.js + Express API with Prisma and PostgreSQL (Neon). It also serves the frontend. |
| `frontend/` | Dashboard and public forms (plain HTML, CSS and JavaScript) |

Everything runs on **one address: http://localhost:4000**. There's no second server and no extra port.

## Run it

**Easiest:** double-click **`start-crm.bat`**.
- It starts the CRM and opens the browser after a few seconds.
- Keep the black window open while you use the CRM. Close it to stop.

**Or from a terminal** (PowerShell or the VS Code terminal):

```powershell
cd backend
npm start
```

Then open **http://localhost:4000**.

| Page | URL |
|---|---|
| CRM dashboard (sign in) | http://localhost:4000 |
| Customer enquiry form | http://localhost:4000/customer.html |
| Developer project form | http://localhost:4000/developer.html |
| Agent / broker form | http://localhost:4000/broker.html |

To stop it, press **Ctrl + C** in the terminal, or close the window.

## First-time setup (new computer)

```powershell
cd backend
copy .env.example .env     # fill in DATABASE_URL, DIRECT_URL and JWT_SECRET
npm install                # also generates the Prisma client
npx prisma migrate deploy  # creates the tables (empty database only; never deletes data)
npm run create-admin       # creates the first Super Admin (asks for email + password)
```

There's no public sign-up. The Super Admin adds other staff from **Sales Team → Add team member**.

## Roles

| | Super Admin | Sales Manager | Sales Representative |
|---|---|---|---|
| See leads | all | all | only assigned to them |
| Update status, notes, follow-ups, site visits | ✓ | ✓ | own leads |
| Assign leads | ✓ | ✓ | ✗ |
| Review developer/broker submissions | ✓ | ✓ | ✗ |
| Reports | all | all | own leads |
| CSV export | ✓ | ✓ | ✗ |
| Manage users | ✓ | view only | ✗ |

The server enforces every rule. The UI only hides buttons a role can't use.

## Where data is stored

Everything is in the PostgreSQL database set in `backend/.env`. It has four tables:

| Table | Holds |
|---|---|
| `crm_users` | staff accounts (passwords are bcrypt-hashed) |
| `leads` | every enquiry; extra form fields, follow-ups and reviews are in its `metadata` column |
| `lead_activities` | history of each lead: notes, calls, status changes, assignments |
| `site_visits` | scheduled property visits |

To browse the data, run `npx prisma studio` from `backend/`.

## Security

- Passwords are hashed with bcrypt.
- Sessions use a signed token in an httpOnly, `SameSite=Strict` cookie and last 8 hours.
- Sign out is in the top bar, on the Account & Settings page, and in the sidebar.
- Every request re-checks the user's role and whether their account is still active.
- Login and the public forms are rate-limited, and every input is validated on the server.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 4000 is already in use` | The CRM is already running in another window. Open http://localhost:4000, or close that window and start again. |
| "Cannot reach the CRM server" on the login page | The backend isn't running. Start it with `start-crm.bat` or `npm start`. |
| `'node' is not recognized` | Use PowerShell or the VS Code terminal, not Git Bash. |
| `Postgres (Prisma) error` | Check your internet connection and the database URLs in `backend/.env`. |
| Forgot the admin password | Ask another admin to reset it on the Sales Team page. |

## Tests

These write test records (`@crm-test.invalid`) and delete them afterwards. Use a development database only.

```powershell
cd backend
npm run db:check                                              # read-only health check
$env:CRM_TEST_WRITES_DATABASE="<your-dev-db-name>"; npm run test:integration
```

The integration test makes 89 checks covering login, roles, forms, leads, follow-ups, visits, reviews, reports and export.

## Known limitations

- **Website enquiries aren't connected.** The website's own enquiries live in a different database. To see them here, point `DATABASE_URL`/`DIRECT_URL` at that database. Don't run migrations against it.
- **Managers see all leads.** The schema has no manager-to-team link.
- **Staff appear by email.** The users table has no name column.
