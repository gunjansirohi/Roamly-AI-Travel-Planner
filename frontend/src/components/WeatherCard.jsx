import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../config";
import "./WeatherCard.css";

// Session cache makes repeat visits instant and becomes a stale fallback during a temporary outage.
const CACHE_TTL = 10 * 60 * 1000;
const weatherCache = new Map();
// Browser API routing is centrally defined in src/config.js, without build-time
// environment variables or any client-side provider secrets.
const WEATHER_ENDPOINT = API_ENDPOINTS.weather;

const weatherSymbol = (id = 800) => {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return "☀️";
  return "⛅";
};
const localDate = (unix, offset) => new Date((unix + offset) * 1000);
const dayName = (unix, offset, short = false) => localDate(unix, offset).toLocaleDateString("en-US", { weekday: short ? "short" : "long", timeZone: "UTC" });
const clock = (unix, offset) => localDate(unix, offset).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const hourLabel = (unix, offset) => localDate(unix, offset).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
const celsius = (value) => `${Math.round(value)}°`;

// Do not render incomplete provider responses; this prevents blank or crashing weather cards.
function hasRenderableWeather(weather) {
  return Boolean(weather?.location?.name && Number.isFinite(weather?.current?.temp) && weather?.current?.weather?.[0] && Array.isArray(weather.hourly) && Array.isArray(weather.daily));
}

function recommendations(weather) {
  const current = weather.current;
  const nextDay = weather.daily.slice(0, 2);
  const isStormy = nextDay.some((item) => item.weather?.[0]?.id < 300);
  const rainy = nextDay.some((item) => item.pop >= 0.45 || (item.weather?.[0]?.id >= 300 && item.weather?.[0]?.id < 600));
  const advice = [];
  if (isStormy) advice.push("Storms are possible—keep outdoor plans flexible and follow local advisories.");
  else if (rainy) advice.push("Pack a compact umbrella; rain is likely during your stay.");
  if (current.temp >= 28 || current.uvi >= 6) advice.push("Use sunscreen, stay hydrated, and plan shade breaks around midday.");
  if (current.temp <= 12) advice.push("Bring warm layers for cooler temperatures, especially after sunset.");
  if (!advice.length) advice.push("Comfortable conditions ahead—ideal for exploring on foot.");
  return advice.slice(0, 2);
}

// The card owns safe request, retry, cache, and display behavior while the planner owns city input.
export default function WeatherCard({ destination }) {
  const city = destination.trim();
  const [state, setState] = useState({ status: "idle", data: null, message: "", stale: false });

  useEffect(() => {
    if (city.length < 2) { setState({ status: "idle", data: null, message: "", stale: false }); return undefined; }
    const cacheKey = city.toLowerCase();
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) { setState({ status: "ready", data: cached.data, message: "", stale: false }); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((previous) => ({ ...previous, status: "loading", message: "", stale: false }));
      const url = `${WEATHER_ENDPOINT}${WEATHER_ENDPOINT.includes("?") ? "&" : "?"}city=${encodeURIComponent(city)}`;
      console.info("[Weather] Request", { city, url });
      let lastError;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch(url, { signal: controller.signal });
          const text = await response.text();
          let payload;
          try { payload = text ? JSON.parse(text) : null; } catch {
            // A 404 HTML page means the request reached the frontend/static host, not the Express weather route.
            if (response.status === 404) throw new Error("Weather API route was not found. Check the configured API URL.");
            throw new Error("The weather service returned an invalid response. Please try again.");
          }
          console.info("[Weather] Response", { city, attempt, status: response.status, payload });
          if (!response.ok || !payload?.success) {
            // Do not collapse a route failure into the generic "Forecast unavailable" heading.
            if (response.status === 404 && !payload?.error?.message) throw new Error("Weather API route was not found. Check the configured API URL.");
            throw new Error(payload?.error?.message || `Weather request failed (${response.status}).`);
          }
          if (!hasRenderableWeather(payload.weather)) throw new Error("The weather service returned incomplete forecast data. Please try again.");
          weatherCache.set(cacheKey, { data: payload.weather, savedAt: Date.now() });
          // The API can return an expired server cache during an outage; label it honestly in the UI.
          setState({ status: "ready", data: payload.weather, message: payload.stale ? "Showing saved weather because the live forecast could not be refreshed." : "", stale: Boolean(payload.stale) });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
          lastError = error;
          console.error("[Weather] Request failed", { city, attempt, message: error.message });
        }
      }
      // Preserve a previously shown forecast when a new refresh has a transient failure.
      if (cached?.data && hasRenderableWeather(cached.data)) setState({ status: "ready", data: cached.data, message: "Showing saved weather because the live forecast could not be refreshed.", stale: true });
      else setState({ status: "error", data: null, message: lastError?.message || "Unable to reach the weather service. Check your connection and try again.", stale: false });
    }, 650);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [city]);

  if (!city || state.status === "idle") return null;
  if (state.status === "loading") return <WeatherSkeleton city={city} />;
  if (state.status === "error") return <section className="weather-error" role="alert"><span>☁️</span><div><strong>Forecast unavailable for {city}</strong><p>{state.message}</p></div></section>;
  if (!hasRenderableWeather(state.data)) return null;

  const { data } = state;
  const { current, daily, hourly, timezoneOffset } = data;
  const summary = current.weather[0];
  return <AnimatePresence mode="wait"><motion.section className="weather-card" aria-label={`Weather forecast for ${data.location.name}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <div className="weather-card__top"><div><p className="weather-kicker">LIVE TRAVEL WEATHER</p><h3>{data.location.name}{data.location.country ? `, ${data.location.country}` : ""}</h3><p className="weather-updated">Updated now · Metric units</p></div><div className="weather-current"><span>{weatherSymbol(summary.id)}</span><strong>{celsius(current.temp)}</strong><p>{summary.description}</p></div></div>
    {state.stale && <p className="weather-stale" role="status">{state.message}</p>}
    <div className="weather-details"><Detail label="Feels like" value={celsius(current.feels_like)} /><Detail label="Humidity" value={`${current.humidity}%`} /><Detail label="Wind" value={`${Math.round(current.wind_speed * 3.6)} km/h`} /><Detail label="Visibility" value={`${(current.visibility / 1000).toFixed(1)} km`} /><Detail label="Pressure" value={`${current.pressure} hPa`} /><Detail label="UV index" value={current.uvi != null ? current.uvi.toFixed(1) : "—"} /><Detail label="Sunrise" value={clock(current.sunrise, timezoneOffset)} /><Detail label="Sunset" value={clock(current.sunset, timezoneOffset)} /></div>
    <ForecastSection title="7-day forecast" className="daily-forecast">{daily.slice(0, 7).map((item, index) => <div className="daily-item" key={item.dt}><span>{index === 0 ? "Today" : dayName(item.dt, timezoneOffset, true)}</span><b>{weatherSymbol(item.weather?.[0]?.id)}</b><strong>{celsius(item.temp.max)} <small>{celsius(item.temp.min)}</small></strong><em>☔ {Math.round((item.pop || 0) * 100)}%</em></div>)}</ForecastSection>
    <ForecastSection title="Next 24 hours" className="hourly-forecast">{hourly.slice(0, 24).map((item, index) => <div className="hourly-item" key={item.dt}><span>{index === 0 ? "Now" : hourLabel(item.dt, timezoneOffset)}</span><b>{weatherSymbol(item.weather?.[0]?.id)}</b><strong>{celsius(item.temp)}</strong><small>{Math.round((item.pop || 0) * 100)}% rain</small></div>)}</ForecastSection>
    <div className="weather-advice"><span>✦</span><div><h4>Travel smart</h4>{recommendations(data).map((advice) => <p key={advice}>{advice}</p>)}</div></div>
  </motion.section></AnimatePresence>;
}

function Detail({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function ForecastSection({ title, className, children }) { return <div className={`forecast-section ${className}`}><h4>{title}</h4><div className="forecast-scroll">{children}</div></div>; }
function WeatherSkeleton({ city }) { return <section className="weather-card weather-skeleton" aria-live="polite"><div className="weather-loading"><i className="weather-spinner" />Fetching live weather</div><h3>Checking conditions in {city}…</h3><div className="skeleton-lines"><i /><i /><i /><i /></div></section>; }
