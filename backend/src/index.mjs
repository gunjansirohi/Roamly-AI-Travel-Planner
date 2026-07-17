import { createApp } from "./app.mjs";
import config from "./config/index.mjs";
import { connectDatabase } from "./services/database.mjs";

if (process.env.NODE_ENV === "production") {
  const missing = [["MONGODB_URI", config.mongoUri], ["JWT_SECRET", config.jwtSecret], ["CLIENT_URL", config.clientUrl]]
    .filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
}

await connectDatabase(config.mongoUri);
const server = createApp().listen(config.port, () => console.log(`Travel API listening on port ${config.port}`));
server.requestTimeout = config.requestTimeoutMs;
server.headersTimeout = config.requestTimeoutMs + 1_000;

function shutdown(signal) {
  console.info(`${signal} received; closing Travel API.`);
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
