import { createApp } from "../src/app.mjs";
import { connectDatabase } from "../src/services/database.mjs";
import config from "../src/config/index.mjs";

const app = createApp();

let dbPromise;

async function initialize() {
  if (!dbPromise) {
    if (!config.mongoUri) {
      throw new Error("MONGODB_URI is not configured");
    }

    dbPromise = connectDatabase(config.mongoUri);
  }

  return dbPromise;
}

export default async function handler(req, res) {
  try {
    await initialize();
    app(req, res);
  } catch (error) {
    console.error("Vercel API error:", error);

    res.status(500).json({
      success: false,
      error: {
        message: "Internal server error",
      },
    });
  }
}