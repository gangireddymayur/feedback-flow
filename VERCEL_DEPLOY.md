# Deploying ReviewOS Frontend to Vercel

This deployment split keeps each service focused:

| Service     | Host        | Responsibility                     |
| ----------- | ----------- | ---------------------------------- |
| Frontend    | Vercel      | React dashboard, SPA routes, HTTPS |
| Backend API | Plesk       | Express endpoints under `/api`     |
| Database    | Plesk MySQL | ReviewOS tables and data           |

## How the frontend reaches Plesk

The Vercel site calls same-origin URLs such as `/api/auth/login`. The
[`vercel.json`](./vercel.json) configuration forwards those API requests to
the Plesk Node.js application.

Do **not** create `VITE_API_URL` in Vercel for this setup. Leaving it unset
prevents a Vercel HTTPS page from directly calling the current Plesk HTTP URL.

Once SSL is enabled on the Plesk domain, change the two Plesk destinations in
`vercel.json` from `http://` to `https://`.

## Deploy the frontend

1. Push this project to GitHub.
2. In Vercel, import the GitHub repository.
3. Use the repository root as the project root.
4. Vercel reads these settings from `vercel.json`:

```text
Build Command: npm run build:vercel
Output Directory: dist
```

5. Do not add `VITE_API_URL` in Vercel environment variables.
6. Deploy.

Direct frontend routes such as `/login`, `/devices`, and `/templates` are
rewritten to `index.html`, so refreshes work on Vercel.

## Keep the backend on Plesk

The Plesk Node.js application still needs a working `.env` in its `server/`
application root:

```env
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=reviewos_user
DB_PASSWORD=<your database password>
DB_NAME=reviewos
JWT_SECRET=<a long random secret>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=*
```

Run the backend migration in Plesk and restart the Node.js app:

```text
migrate
```

Check the backend directly:

```text
http://ecstatic-shockley.103-69-196-157.plesk.page/health
```

It must return `"database":"ok"` before sign-in can succeed from Vercel.

## Local frontend development

For local Vite development only, create an uncommitted `.env.local` if you
want the browser to connect directly to the Plesk API:

```env
VITE_API_URL=http://ecstatic-shockley.103-69-196-157.plesk.page
```

The committed `.env` was removed intentionally; production frontend requests
should pass through Vercel's `/api` rewrite.
