// Central server configuration.
// Keep this file server-only.
import "dotenv/config";
const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);


  const deployedClientOrigins = [
  "https://roamly-ai-travel-planner-t.vercel.app",
  "http://localhost:5173",
];


deployedClientOrigins.forEach((origin) => {
  if (!clientOrigins.includes(origin)) {
    clientOrigins.push(origin);
  }
});

const config = Object.freeze({
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || "",

  amadeusClientId: process.env.AMADEUS_CLIENT_ID || "",
  amadeusClientSecret: process.env.AMADEUS_CLIENT_SECRET || "",

  mongoUri: process.env.MONGODB_URI || "",

  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",

  port: process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 5000,

  clientOrigins,

  trustProxy: process.env.TRUST_PROXY === "true",

  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "development-only-change-me"),

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",

  rememberMeExpiresIn:
    process.env.JWT_REMEMBER_EXPIRES_IN || "30d",

  clientUrl: process.env.CLIENT_URL || "",

  requestTimeoutMs: Number.parseInt(
    process.env.API_TIMEOUT_MS || "15000",
    10
  ),
});

export default config;