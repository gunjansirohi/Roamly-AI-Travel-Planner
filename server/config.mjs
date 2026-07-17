// Central server configuration. Keep this file server-only: never import it
// from src/ because it contains private provider API keys.
// These values load from environment variables, with fallback defaults.

try {
  // programmatically load environment variables from .env file (supported in Node.js 20.6.0+)
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch (error) {
  // If .env file is missing or fails to load, ignore and use existing env / defaults
}

const config = Object.freeze({
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  clientOrigins: ["http://localhost:3000", "http://localhost:5001", "http://127.0.0.1:5000"],
});

export default config;
