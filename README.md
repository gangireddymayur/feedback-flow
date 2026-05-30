# ReviewOS

Self-hosted review-management platform. Runs as a single Node.js app on Plesk
(Node 18+) talking to MariaDB.

Stack:
- **Frontend**: React 19 + Vite + TanStack Router (client-side SPA in `dist/`)
- **Backend**: Express 5 + mysql2 + JWT (`app.js`)
- **DB**: MariaDB / MySQL (`db/schema.sql`)

---

## Local dev

```bash
bun install
bun run dev        # Vite dev server with mock API (no backend needed)
```

The mock API is auto-used whenever `/api/me` is unreachable, so the Lovable
preview keeps working without a database.

---

## Deploy to Plesk (production)

### 1 · Create the database

Plesk → **Databases** → your `Review_Management_System` DB → **phpMyAdmin** →
**Import** → upload `db/schema.sql`. This creates all tables and seeds:

| Email                | Password       | Role  |
| -------------------- | -------------- | ----- |
| `admin@reviewos.app` | `1m2a3y4u5r`   | super |
| `aisha@brand.co`     | `ChangeMe!2026`| sub   |
| `marco@hotelnorth.com` | `ChangeMe!2026` | sub |
| `priya@retailgroup.in` | `ChangeMe!2026` | sub |

**Change these passwords from the app immediately after first login.**

### 2 · Wire GitHub → Plesk

Plesk → **Websites & Domains** → `exciting-greider.103-69-196-157.plesk.page`
→ **Git** → Connect your GitHub repo (branch `main`).

In the **Repository → Deployment** panel, enable:
- **Automatic deployment** when commits are pushed
- **Additional deploy actions** (shell script):
  ```sh
  npm install --omit=dev=false
  npm run build
  ```

### 3 · Configure the Node.js app

Plesk → **Node.js** panel for the same domain:

| Setting                    | Value                                                          |
| -------------------------- | -------------------------------------------------------------- |
| Node.js Version            | 18.20.6                                                        |
| Package Manager            | npm                                                            |
| Application Mode           | production                                                     |
| Application Root           | `/exciting-greider.103-69-196-157.plesk.page`                  |
| Application Startup File   | `app.js`                                                       |

**Environment Variables** (click "Add"):

| Name          | Value                                  |
| ------------- | -------------------------------------- |
| `DB_HOST`     | `localhost`                            |
| `DB_PORT`     | `3306`                                 |
| `DB_USER`     | `Review_Management_System`             |
| `DB_PASSWORD` | (your MariaDB password)                |
| `DB_NAME`     | `Review_Management_System`             |
| `JWT_SECRET`  | (run `openssl rand -hex 32` to generate) |

### 4 · First deploy

```bash
git push origin main
```

Plesk pulls the code, runs `npm install && npm run build`, then click **Restart App** in the Node.js panel.

Open `https://exciting-greider.103-69-196-157.plesk.page/login` and sign in with
`admin@reviewos.app` / `1m2a3y4u5r`.

---

## Project layout

```
app.js                ← Plesk startup file (Express + API + SPA fallback)
db/schema.sql         ← MariaDB schema + seed
src/                  ← React SPA
  ├─ lib/api.ts       ← typed API client (real /api/* with mock fallback)
  ├─ routes/          ← TanStack Router pages
  └─ components/      ← UI
dist/                 ← Vite build output (Plesk's deploy script generates this)
```

## API endpoints

All endpoints return JSON. Auth = `Authorization: Bearer <jwt>` header.

```
POST   /api/auth/login          { email, password }      → { token, user }
GET    /api/me                                            → { user }

GET    /api/templates                                     → { templates: [] }
POST   /api/templates           { name, ... }             → { id }
PUT    /api/templates/:id       { name, ... }             → { ok }
DELETE /api/templates/:id                                 → { ok }

GET    /api/devices                                       → { devices: [] }
POST   /api/devices/pair        { code, name, location }  → { id }
PUT    /api/devices/:id/template { template_id }          → { ok }
DELETE /api/devices/:id                                   → { ok }

GET    /api/responses                                     → { responses: [] }

GET    /api/admins              (super only)              → { admins: [] }
POST   /api/admins              (super only)              → { id }
PUT    /api/admins/:id/status   { status }                → { ok }
```
