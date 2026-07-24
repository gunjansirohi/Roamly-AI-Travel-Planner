// Vite replaces these expressions at build time; using process.env also keeps
// this small configuration module compatible with the existing Jest suite.




const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

export const API_ENDPOINTS = Object.freeze({
  itinerary: apiUrl("/api/ai-trip"),
  weather: apiUrl("/api/weather"),
});