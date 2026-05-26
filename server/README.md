# ReviewOS Backend (Express + MySQL) — Plesk Deployment

Self-hosted REST API for the ReviewOS dashboard and Android devices.
Built for Plesk's **Node.js** extension + **MySQL** databases.

---

## 1. Create the database in Plesk

1. Plesk → **Databases** → **Add Database**
   - Name: `reviewos`
   - User: `reviewos_user`
   - Password: pick a strong one (save it)
2. Plesk → **phpMyAdmin** → open the new DB → **Import** → upload
   `server/scripts/schema.sql` (or run `npm run migrate` after step 3).

## 2. Upload the backend

1. Plesk → **Files** → open the domain (e.g. `api.yourdomain.com` or a
   subdomain like `angry-kalam.103-69-196-157.plesk.page`).
2. Upload the entire `server/` folder into the domain's document root
   (or `/httpdocs/` depending on your Plesk setup).
3. Rename `server/.env.example` to `.env` and fill in the DB credentials
   from step 1, plus a long random `JWT_SECRET`.

## 3. Enable Node.js in Plesk

1. Plesk → your domain → **Node.js** → **Enable Node.js**
2. Configure:
   - **Node.js version**: 18 or newer
   - **Application mode**: `production`
   - **Application root**: the folder where you uploaded `server/`
   - **Application startup file**: `server.js`
3. Click **NPM install** — Plesk installs the dependencies.
4. Click **Restart App**.

## 4. Run migrations (one time)

In Plesk → **Node.js** → **Run script** → enter `migrate` → Run.
This applies `schema.sql` and seeds a default super admin:

```
Email:    admin@reviewos.app
Password: changeme123
```

**Change this password immediately after first login.**

## 5. Point the frontend at the API

In your Lovable project, set the API base URL (e.g. `VITE_API_URL`) to
your Plesk domain, e.g. `https://api.yourdomain.com`. Make sure
`CORS_ORIGINS` in `.env` includes your Lovable frontend domain.

---

## Endpoints

| Method | Path                          | Auth        | Purpose                         |
|--------|-------------------------------|-------------|---------------------------------|
| GET    | `/health`                     | none        | Health check                    |
| POST   | `/api/auth/login`             | none        | Email + password login          |
| GET    | `/api/auth/me`                | bearer      | Current user                    |
| GET    | `/api/templates`              | bearer      | List templates                  |
| POST   | `/api/templates`              | bearer      | Create template                 |
| PUT    | `/api/templates/:id`          | bearer      | Update template                 |
| DELETE | `/api/templates/:id`          | bearer      | Delete template                 |
| GET    | `/api/devices`                | bearer      | List paired devices             |
| POST   | `/api/devices/pair`           | bearer      | Pair a new Android device       |
| POST   | `/api/devices/:id/heartbeat`  | device      | Device → server keepalive       |
| GET    | `/api/responses`              | bearer      | Recent responses                |
| POST   | `/api/responses/submit`       | device      | Device → server submit review   |
| GET    | `/api/admins`                 | super only  | List sub admins                 |
| POST   | `/api/admins`                 | super only  | Create sub admin                |
| PATCH  | `/api/admins/:id/status`      | super only  | Enable / disable an admin       |

## Local development

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

API will be at `http://localhost:3001`.
