import { createApp } from "./app.mjs";
import config from "./config/index.mjs";
import { connectDatabase } from "./services/database.mjs";

if (process.env.NODE_ENV === "production") {
  const missing = [
    ["MONGODB_URI", config.mongoUri],
    ["JWT_SECRET", config.jwtSecret],
    ["CLIENT_URL", config.clientUrl]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`
    );
  }
}

await connectDatabase(config.mongoUri);

const app = createApp();

export default app;