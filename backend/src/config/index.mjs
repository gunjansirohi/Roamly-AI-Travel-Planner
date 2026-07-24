// Central server configuration. Keep this file server-only: never import it
// from src/ because it contains private provider API keys.
// Load local secrets at runtime without exposing them to application code or logs.
// Deployment environment variables remain supported and take precedence.
try {
  if (typeof process.loadEnvFile === "function") {
    // Workspace scripts run with backend/ as cwd while the shared .env lives
    // at the repository root. Load both conventional locations without
    // overriding variables already supplied by the deployment environment.
    for (const location of [new URL("../../../.env", import.meta.url), new URL("../../.env", import.meta.url)]) {
      try { process.loadEnvFile(location); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    }
  }
} catch {
  // A missing or malformed .env file must not prevent the API from starting.
}
const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Keep the deployed web app allowed even when Railway's optional origin
// variables have not been populated yet.
const deployedClientOrigin = "https://travel-planner-six-nu.vercel.app";
if (!clientOrigins.includes(deployedClientOrigin)) clientOrigins.push(deployedClientOrigin);

const config = Object.freeze({
  // API secrets come only from the host environment.
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  amadeusClientId: process.env.AMADEUS_CLIENT_ID || "",
  amadeusClientSecret: process.env.AMADEUS_CLIENT_SECRET || "",
  mongoUri: process.env.MONGODB_URI || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  clientOrigins,
  trustProxy: process.env.TRUST_PROXY === "false",
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "development-only-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  rememberMeExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || "30d",
  clientUrl: process.env.CLIENT_URL || "",
  requestTimeoutMs: Number.parseInt(process.env.API_TIMEOUT_MS || "15000", 10),
});

export default config;
