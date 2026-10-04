# Roamly production deployment

## Existing Vercel API

The API is deployed at `https://roamly-ai-travel-planner-khaki.vercel.app`. Confirm `/api/health` responds before deploying frontend changes. Set backend secrets in Vercel's project environment settings; never put them in frontend variables.

Backend variables include `MONGODB_URI`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `OPENWEATHER_API_KEY`, `JWT_SECRET`, and `CLIENT_URL`. Set `CLIENT_URL` to the exact frontend origin used by cookie authentication.

## Frontend on Vercel

1. Import the repository in Vercel and configure the frontend project to build the Vite app in `frontend/`.
2. Set `VITE_API_BASE_URL` to `https://roamly-ai-travel-planner-khaki.vercel.app` and set the browser-restricted `VITE_GOOGLE_MAPS_API_KEY`.
3. Deploy. Vercel serves `frontend/dist`; client-side routes use the SPA rewrite.
4. Ensure the API's `CLIENT_URL` matches the final frontend origin. Preview domains are intentionally not accepted by production CORS.

Frontend install: `npm ci --workspaces=false`  
Frontend build: `npm run build`  
Local preview: `npm run preview`  
Run these from `frontend/`.

## Environment variables

Frontend (public at build time):

- `VITE_API_BASE_URL` — HTTPS origin of the Vercel API (`https://roamly-ai-travel-planner-khaki.vercel.app`).
- `VITE_GOOGLE_MAPS_API_KEY` — browser key restricted to the Maps APIs and exact frontend HTTP referrers.

Backend (secret unless noted):

- `PORT` — listening port when running locally.
- `MONGODB_URI` — MongoDB Atlas connection string.
- `GEMINI_API_KEY` — Gemini server key.
- `GOOGLE_MAPS_API_KEY` — server key for Google Places requests; restrict by API and server IP where practical.
- `OPENWEATHER_API_KEY` — OpenWeather server key.
- `JWT_SECRET` — cryptographically random signing secret (at least 32 bytes).
- `CLIENT_URL` — exact frontend origin used by CORS and password-reset URLs.

Optional: `API_TIMEOUT_MS` defaults to 15000 and `TRUST_PROXY=true` is recommended behind a proxy.

## Common deployment issues

- **Frontend route returns 404 on refresh:** verify the Vercel SPA rewrite exists.
- **CORS or failed cookie authentication:** `CLIENT_URL` must exactly match the browser origin, including `https://` and excluding a path/trailing slash. Redeploy the API after changing it. Production cookies require HTTPS.
- **API calls hit the frontend:** verify `VITE_API_BASE_URL`, then rebuild/redeploy; Vite variables are embedded at build time.
- **MongoDB connection fails:** URL-encode special characters in the password, verify the Atlas user/database, and update Atlas Network Access.
- **Provider returns 401/403:** check key names, enabled APIs, billing, quotas, and key restrictions. Never put server keys in `VITE_*` variables.
- **Vercel API health check fails:** inspect function logs for missing required variables and query `/api/health`; a disconnected database is reported in the JSON.
- **Old frontend configuration persists:** trigger a fresh Vercel deployment after changing any `VITE_*` value.
- **Windows `EPERM` mentions `esbuild.exe`:** a running Vite process is locking the root workspace binary. For an isolated backend install, use `npm ci --omit=dev --workspaces=false` from `backend/`. If intentionally reinstalling the whole root workspace, stop the Vite process first and rerun the root install.
