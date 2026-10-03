import { createApp } from "../src/app.mjs";
import config from "../src/config/index.mjs";
import { connectDatabase } from "../src/services/database.mjs";

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

const app = createApp();

let dbPromise;

async function initialize() {
  if (!dbPromise) {
    dbPromise = connectDatabase(config.mongoUri);
  }

  await dbPromise;
}

export default async function handler(req, res) {
  await initialize();
  return app(req, res);
}