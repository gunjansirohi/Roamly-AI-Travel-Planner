# Roamly production deployment

## 1. Deploy the backend to Render

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Render, create a Blueprint from `render.yaml` (or create a Web Service with root directory `backend`).
3. Set every backend variable listed below. Render supplies `PORT`; do not hardcode it.
4. Deploy and confirm `https://YOUR-SERVICE.onrender.com/api/health` returns HTTP 200.
5. In MongoDB Atlas, create a database user and allow Render's outbound access. If a fixed egress IP is unavailable, Atlas can temporarily allow `0.0.0.0/0`; compensate with a strong database password and least-privilege user.

Backend build: `npm ci --omit=dev --workspaces=false`  
Backend start: `npm start`  
Run both from `backend/`.

## 2. Deploy the frontend to Vercel

1. Import the same repository in Vercel and leave the project root at the repository root; `vercel.json` defines the workspace build and output directory.
2. Set `VITE_API_URL` to the Render origin with no trailing slash and set the browser-restricted `VITE_GOOGLE_MAPS_API_KEY`.
3. Deploy. The rewrite in `vercel.json` sends client-side routes to `index.html`, fixing refresh 404s.
4. Copy the final Vercel origin into Render's `CLIENT_URL` and redeploy the backend.
5. If Vercel assigns a new production domain, update `CLIENT_URL`; preview domains are intentionally not accepted by production CORS.

Frontend install: `npm ci --workspaces=false`  
Frontend build: `npm run build`  
Local preview: `npm run preview`  
Run these from `frontend/`. Vercel serves `frontend/dist`; there is no frontend start command in production.

## Environment variables

Frontend (public at build time):

- `VITE_API_URL` — HTTPS origin of the Render API.
- `VITE_GOOGLE_MAPS_API_KEY` — browser key restricted to the Maps APIs and the exact Vercel/custom-domain HTTP referrers.

Backend (secret unless noted):

- `PORT` — listening port; supplied by Render.
- `MONGODB_URI` — MongoDB Atlas connection string.
- `GEMINI_API_KEY` — Gemini server key.
- `GOOGLE_MAPS_API_KEY` — server key for Google Places requests; restrict by API and server IP where practical.
- `OPENWEATHER_API_KEY` — OpenWeather server key.
- `JWT_SECRET` — cryptographically random signing secret (at least 32 bytes).
- `CLIENT_URL` — exact frontend origin used by CORS and password-reset URLs.

Optional: `API_TIMEOUT_MS` defaults to 15000 and `TRUST_PROXY=true` is recommended on Render.

## Common deployment issues

- **Frontend route returns 404 on refresh:** deploy from the repository root so Vercel reads `vercel.json`; verify the SPA rewrite exists.
- **CORS or failed cookie authentication:** `CLIENT_URL` must exactly match the browser origin, including `https://` and excluding a path/trailing slash. Redeploy Render after changing it. Production cookies require HTTPS.
- **API calls hit the frontend:** verify `VITE_API_URL`, then rebuild/redeploy; Vite variables are embedded at build time.
- **MongoDB connection fails:** URL-encode special characters in the password, verify the Atlas user/database, and update Atlas Network Access.
- **Provider returns 401/403:** check key names, enabled APIs, billing, quotas, and key restrictions. Never put server keys in `VITE_*` variables.
- **Render health check fails:** inspect startup logs for missing required variables and query `/api/health`; a disconnected database is reported in the JSON while the process remains observable.
- **Render cold starts/timeouts:** use a paid always-on instance for production traffic and keep provider calls below `API_TIMEOUT_MS`.
- **Old frontend configuration persists:** trigger a fresh Vercel deployment after changing any `VITE_*` value.
- **Windows `EPERM` mentions `esbuild.exe`:** a running Vite process is locking the root workspace binary. For an isolated backend install, use `npm ci --omit=dev --workspaces=false` from `backend/`. If intentionally reinstalling the whole root workspace, stop the Vite process first and rerun the root install.
