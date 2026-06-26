# Switch from Vercel/TanStack Start → Plesk Node 18 + MariaDB

You want one box on Plesk to host site + API + DB, deployed via GitHub. The current app is TanStack Start (built for edge/Vercel) with mocked data. To run cleanly on Plesk Node 18 with MariaDB, the cleanest path is to swap the framework for a plain Express + Vite SPA setup. TanStack Start's edge bundler fights Plesk's classic Node runtime; Express + SPA "just works" with Plesk's "Application Startup File".

## Target architecture

```text
Plesk box (Node 18 + MariaDB)
├── app.js                    ← Plesk startup file (Express server)
│   ├── serves /api/*         ← JSON API (auth, templates, devices, responses, sub-admins)
│   └── serves /              ← built React SPA (dist/)
├── dist/                     ← Vite SPA build output (committed via GH? or built on server)
├── db/schema.sql             ← phpMyAdmin import → creates all tables + seeds super admin
└── .env                      ← DB creds, JWT_SECRET (set in Plesk Node.js env vars panel)
```

## Tech changes

| Area      | Now                        | After                                                                            |
| --------- | -------------------------- | -------------------------------------------------------------------------------- |
| Framework | TanStack Start (SSR, edge) | Vite SPA + Express API                                                           |
| Routing   | File-based `src/routes/*`  | React Router (client-side)                                                       |
| Auth      | Mock (localStorage role)   | JWT, bcrypt, MariaDB `users` table                                               |
| Data      | `src/lib/mock-data.ts`     | `mysql2/promise` pool → MariaDB                                                  |
| Build     | `vinxi build` for Vercel   | `vite build` → `dist/`, server is `app.js`                                       |
| Deploy    | `vercel deploy`            | `git push` → Plesk Git pulls → `npm install && npm run build` → restart Node app |

## Work to do

1. **New server** — `app.js` at repo root (Plesk startup file).
   - Express, `mysql2/promise` pool, `bcrypt`, `jsonwebtoken`, `cors`.
   - Routes: `POST /api/auth/login`, `GET /api/me`, `GET/POST/PUT/DELETE /api/templates`, `/api/devices` (with `assignTemplate`), `/api/responses`, `/api/sub-admins`.
   - Role check middleware: `super` vs `sub`.
   - Static-serves `dist/` for everything else (SPA fallback to `index.html`).
2. **Frontend re-route** — replace TanStack Start with React Router DOM.
   - Strip `src/routes/__root.tsx`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/start.ts`, `src/server.ts`, `src/spa.tsx`, `vite.vercel.config.ts`, `vercel.json`.
   - New `src/main.tsx` mounts `<BrowserRouter>` with the same pages (login, dashboard, templates, devices, responses, analytics, admins, settings).
   - `src/lib/api.ts` → real `fetch('/api/...')` calls with `Authorization: Bearer <jwt>` from localStorage.
3. **DB schema** — `db/schema.sql` (you import via phpMyAdmin → Import dump):
   ```sql
   CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), role ENUM('super','sub'), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
   CREATE TABLE templates (id INT AI PK, owner_id INT, name, description, category, status ENUM('active','inactive','draft'), questions JSON, created_at, updated_at, FK owner_id→users.id);
   CREATE TABLE devices (id INT AI PK, owner_id INT, name, location, status, android_version, last_sync DATETIME, template_id INT NULL, FK template_id→templates.id);
   CREATE TABLE responses (id INT AI PK, template_id INT, device_id INT, rating TINYINT, comment TEXT, duration_seconds INT, submitted_at DATETIME);
   ```
   Mirrors `src/lib/mock-data.ts` 1:1. Seeds one super admin (`admin@reviewos.app` / password you pick).
4. **Vite config** — strip TanStack plugins, keep React + Tailwind v4 + path alias. Output to `dist/`.
5. **package.json scripts**:
   - `"build": "vite build"`
   - `"start": "node app.js"`
   - Add deps: `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, `react-router-dom`. Remove all `@tanstack/*` start/router/vinxi/vercel packages.

## Plesk deploy flow (after this rebuild)

```text
1. GitHub repo → Plesk → Websites & Domains → Git → connect repo, branch=main
2. Enable "Additional deploy actions": npm install && npm run build
3. Node.js panel:
     Application Mode: production
     Application Startup File: app.js
     Node.js Version: 18.20.6
     Environment variables:
       DB_HOST=localhost
       DB_PORT=3306
       DB_USER=Review_Management_System
       DB_PASSWORD=••••
       DB_NAME=Review_Management_System
       JWT_SECRET=<long random>
4. phpMyAdmin → Review_Management_System → Import → db/schema.sql
5. Plesk Node.js → "Restart App"
```

## What to confirm before I start coding

A. **Domain to use** — the site lives at `exciting-greider.103-69-196-157.plesk.page` (Node) or `silly-bhabha.103-69-196-157.plesk.page` (the .NET one)? The screenshots show both; the Node one is correct for us.
B. **Super-admin password seed** — what should the initial `admin@reviewos.app` password be? I'll bcrypt it in `db/schema.sql`.
C. **Lovable preview** — once we swap to Express + React Router, the Lovable preview here still works (it just runs `vite dev` on the SPA), but the API won't (no MariaDB in the sandbox). I'll add a `?mock=1` fallback so the Lovable preview keeps showing mock data; Plesk will hit the real API. OK?

If A/B/C are good, I'll execute the whole plan in one pass (server, schema.sql, gut TanStack, new React Router app, package.json, README with the Plesk steps).
