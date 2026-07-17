# Roamly travel data and provider integration

## Providers

- **Gemini** generates Markdown itineraries on the Express server.
- **Google Places API (New)** supplies live hotel and restaurant search, details, photos, ratings, hours, contact information, coordinates, websites, and Maps links.
- **OpenWeather** supplies destination weather snapshots.
- **Amadeus Self-Service Flight Offers** supplies live flight offers, segments, prices, cabin and baggage data. When credentials are absent or the provider is unavailable, Roamly labels cached/demo results explicitly.
- Provider credentials are server-only. React never receives API secrets.

## MongoDB schema

- `Users`: identity, profile, preferences and password hash.
- `Trips`: owner, destination, dates, budget/currency, itinerary, weather snapshot, selected hotel/restaurant/flight, status and favorite flag.
- `Favorites`: owner, entity type/id and a display snapshot.
- `Hotels`, `Restaurants`, `Flights`: owner, provider ID and the normalized provider snapshot at save time.
- `SearchHistory`: owner, query, category and optional metadata.

All owned collections are indexed by `userId`; provider saves and favorites have compound unique indexes to prevent duplicates. All schemas use timestamps.

## API endpoints

Authentication endpoints live under `/api/auth`. Travel data endpoints require the HTTP-only JWT session:

- `GET|POST /api/trips`
- `GET|PUT|DELETE /api/trips/:id`
- `POST /api/trips/:id/duplicate`
- `PUT /api/trips/:id/favorite`
- `GET|POST /api/saved/:type` where type is `hotels`, `restaurants`, or `flights`
- `DELETE /api/saved/:type/:providerId`
- `POST /api/search-history`
- `GET /api/dashboard`

Public discovery endpoints remain available for guests: `/api/hotels`, `/api/restaurants`, `/api/flights`, `/api/weather`, destination search, place details and image proxy routes. `/api/ai-trip` requires login and automatically creates a `Trips` record.

## Environment variables

Copy `backend/.env.example` values into the root `.env`. For Atlas use:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/roamly?retryWrites=true&w=majority
JWT_SECRET=a-long-random-production-secret
CLIENT_URL=http://localhost:3000
CLIENT_ORIGINS=http://localhost:3000
GEMINI_API_KEY=
GOOGLE_MAPS_API_KEY=
OPENWEATHER_API_KEY=
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
```

In Atlas, create a database user, allow the deployment server IP in Network Access, URL-encode special characters in the password, and never commit `.env`.

## Local setup

1. Install Node.js 20+ and provide either a local MongoDB instance or Atlas URI.
2. Run `npm install` at the repository root.
3. Configure `.env`.
4. Run `npm start`; it launches API port 5000 and React port 3000.
5. Create an account before generating or saving travel data.

## Deployment

Build the frontend with `npm run build`. Deploy `backend/` as a Node service with `NODE_ENV=production`, `JWT_SECRET`, `MONGODB_URI`, provider credentials, `CLIENT_URL`, and exact `CLIENT_ORIGINS`. Deploy the frontend build behind HTTPS and set `REACT_APP_API_BASE_URL` to the HTTPS API origin. HTTPS is required for production secure cookies. The included Compose file can be used for self-hosted MongoDB; replace its Mongo URI with Atlas when using Atlas.

## Reliability and performance

Provider routes retain TTL caches and cached/fallback responses. Search inputs are debounced, cards and images lazy-load, result pages use skeletons and retry states, and Mongo list endpoints expose bounded pagination (`page`, `limit`, maximum 50). Provider failures return friendly structured errors and never expose credentials.
