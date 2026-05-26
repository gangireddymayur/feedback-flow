# Deploying the ReviewOS Backend to Plesk

Your API will live at:
**`https://silly-bhabha.103-69-196-157.plesk.page`**

> ⚠️ **You MUST enable SSL.** The Lovable frontend runs on HTTPS, and browsers
> block any call from HTTPS → plain HTTP (mixed-content). Without SSL the
> dashboard will show a "Network error reaching API" toast on login.

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
- Application root: `/httpdocs/api`  (or any folder you choose)
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

Plesk → **Node.js** → click **NPM Install**.
Wait until you see the success banner.

## 6. Run the migration

Plesk → **Node.js** → **Run script** → enter:
```
scripts/migrate.js
```
This creates the tables and the first super-admin:
- Email: `admin@reviewos.app`
- Password: `changeme123`  ← change it after first login!

## 7. Start the app

Plesk → **Node.js** → **Restart App**.
Open **`https://<your-domain>/health`** in your browser — you should see:
```json
{"ok":true,"ts":...}
```

## 8. Enable SSL (CRITICAL)

Plesk → **SSL/TLS Certificates** → **Install Free Basic Certificate by Let's Encrypt**.
After it finishes, force HTTPS in **Hosting Settings**.

## 9. Connect the frontend

In the Lovable project, the file `.env` already contains:
```
VITE_API_URL=https://ecstatic-shockley.103-69-196-157.plesk.page
```
After you publish the frontend, log in with the seeded super-admin account.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Network error reaching API" | Mixed content (HTTP API) | Enable SSL in Plesk (step 8) |
| `401 Invalid credentials` | Wrong password | Re-run migrate or reset via DB |
| `CORS` error in browser console | Origin not allowed | Set `CORS_ORIGINS=*` then restart |
| `ER_ACCESS_DENIED_ERROR` in logs | DB password mismatch | Fix `.env`, restart Node app |
| 502 / 503 from Plesk | App crashed at boot | Check **Node.js → Show logs** |
