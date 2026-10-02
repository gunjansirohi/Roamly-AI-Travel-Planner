import { createApp } from "../src/app.mjs";
import config from "../src/config/index.mjs";
import { connectDatabase } from "../src/services/database.mjs";

let dbPromise;

async function initializeDatabase() {
  if (!dbPromise) {
    dbPromise = connectDatabase(config.mongoUri);
  }

  await dbPromise;
}

const app = createApp();

export default async function handler(request, response) {
  await initializeDatabase();
  return app(request, response);
}