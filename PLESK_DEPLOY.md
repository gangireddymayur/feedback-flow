# Deploying the ReviewOS Backend to Plesk

> The dashboard frontend is now intended to be hosted on Vercel. See
> [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md). Plesk remains responsible for the
> Express API and MySQL database.

Your API will live at:
**`http://ecstatic-shockley.103-69-196-157.plesk.page`**

> ⚠️ Plesk currently shows the Node.js Application URL as HTTP. This works only
> for temporary API proxying. Enable SSL for this API domain, then update the
> Plesk destinations in `vercel.json` from `http://` to `https://`.
> The server intentionally avoids CSP `upgrade-insecure-requests` while this
> HTTP URL is in use, since that would keep the dashboard assets from loading.

---

## 1. Create the MySQL database

Plesk → **Databases** → **Add Database**

- Database name: `reviewos`
- User: `reviewos_user`
- Password: pick a strong one — copy it for step 4

## 2. Enable Node.js for your domain

Plesk → your domain → **Node.js** → **Enable Node.js**

- Node.js version: 18.x or 20.x
- Document root: leave default
- Application root: `/httpdocs/api` (or any folder you choose)
- Application startup file: `server.js`
- Application mode: `production`

## 3. Upload the `server/` folder

Plesk → **Files** → navigate to the **Application root** from step 2.
Upload the **entire contents** of this project's `server/` folder there.

The folder must contain: `server.js`, `package.json`, `src/`, `scripts/`.

## 4. Create the `.env` file

Inside the same folder, create a file named `.env`:

```
PORT=3001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_USER=reviewos_user
DB_PASSWORD=<the password from step 1>
DB_NAME=reviewos

JWT_SECRET=<a long random string — run `openssl rand -hex 48`>
JWT_EXPIRES_IN=7d

CORS_ORIGINS=*
```

> Once everything works, tighten `CORS_ORIGINS` to your Lovable URLs only.

## 5. Install dependencies

Plesk → **Node.js** → click **NPM Install**. If Plesk runs `npm install --production` and says `npm is not recognized`, ask hosting support to add Node/npm to the Windows PATH for Plesk Node.js tasks, or install dependencies locally and upload the `node_modules` folder with the server files.
Wait until you see the success banner.

## 6. Run the migration

Plesk → **Node.js** → **Run script** → enter:

```
scripts/migrate.js
```

This creates the tables and the first super-admin:

- Email: `admin@reviewos.app`
- Password: `changeme123` ← change it after first login!

## 7. Start the app

Plesk → **Node.js** → **Restart App**.
Open **`http://<your-domain>/`** in your browser. You should see the ReviewOS dashboard.
Then open **`http://<your-domain>/api`** to see the API endpoint list, or
**`http://<your-domain>/health`** — you should see:

```json
{"ok":true,"database":"ok","ts":...}
```

## 8. Enable SSL (CRITICAL)

Plesk → **SSL/TLS Certificates** → **Install Free Basic Certificate by Let's Encrypt**.
After it finishes, force HTTPS in **Hosting Settings**.

## 9. Connect the Vercel frontend

The Vercel frontend uses a same-origin `/api` rewrite configured in
`vercel.json`, so do not set `VITE_API_URL` in Vercel.

After SSL is enabled on this Plesk domain, change the rewrite destinations in
`vercel.json` to use `https://`, redeploy the Vercel frontend, and log in with
the seeded super-admin account.

---

## Troubleshooting

| Symptom                                     | Cause                                                             | Fix                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| "Network error reaching API"                | Mixed content (HTTP API)                                          | Enable SSL in Plesk (step 8)                                        |
| Blank white dashboard on HTTP URL           | Previous server upgraded dashboard assets to unavailable HTTPS    | Deploy the latest `server.js`, then restart the app                 |
| Sign-in fails with an internal server error | Database connection is unavailable or the schema was not migrated | Confirm `.env` database values, run `migrate`, then restart the app |
| `/health` reports `database: "unavailable"` | Node cannot query MySQL                                           | Fix database access in `.env` and restart the app                   |
| `401 Invalid credentials`                   | Wrong password                                                    | Re-run migrate or reset via DB                                      |
| `CORS` error in browser console             | Origin not allowed                                                | Set `CORS_ORIGINS=*` then restart                                   |
| `ER_ACCESS_DENIED_ERROR` in logs            | DB password mismatch                                              | Fix `.env`, restart Node app                                        |
| 502 / 503 from Plesk                        | App crashed at boot                                               | Check **Node.js → Show logs**                                       |
