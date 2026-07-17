# AI Travel Planner

The project is split into independently deployable applications:

```
frontend/   React single-page application
backend/    Node.js and Express API
```

## Local development

From the repository root, install all workspace dependencies once:

```powershell
npm install
```

Run the API in one terminal and the React app in another:

```powershell
npm run dev
npm start
```

The development server proxies `/api` requests to `http://localhost:5000`.

## Production deployment

Deploy `backend` as a Node service using `npm start`. Deploy `frontend` as a static site after `npm run build`, or use the included Dockerfiles. The API exposes `GET /api/health` for platform health checks.

Configure the backend with your deployment platform's environment-variable settings. During local development, the backend loads the root `.env` file at runtime; keep it out of version control.

| Variable | Purpose |
| --- | --- |
| `PORT` | API listening port; defaults to `5000`. |
| `CLIENT_ORIGINS` | Comma-separated public frontend origins, for example `https://app.example.com`. |
| `TRUST_PROXY` | Set to `true` behind a reverse proxy or load balancer. |
| `GEMINI_API_KEY` | Enables itinerary generation. |
| `GEMINI_MODEL` | Optional Gemini model override. |
| `GOOGLE_MAPS_API_KEY` | Enables Google Places hotel and restaurant data. |
| `OPENWEATHER_API_KEY` | Enables OpenWeather forecasts. |
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | Enables Amadeus flight data. |
| `MONGODB_URI` | MongoDB connection used for users, generated trips, favorites, and recent searches. The API continues with local fallbacks if unavailable. |

`GET /api/status` reports Gemini, Weather, Maps, Hotels, Restaurants, and Flights as `Online`, `Offline`, or `Cached`. Provider errors are logged only by the API; client responses contain safe messages and request references.

Build the frontend with the public API origin. This value is compiled into the browser bundle, so it must not contain a secret:

```powershell
$env:REACT_APP_API_BASE_URL = "https://api.example.com"
npm run build
```

## Docker

Build and run both services locally in production mode:

```powershell
docker compose up --build
```

Open `http://localhost:8080`. For a public deployment, change the frontend build argument `REACT_APP_API_BASE_URL` and backend `CLIENT_ORIGINS` to the final HTTPS domains, and add provider keys through the platform's secret manager.
