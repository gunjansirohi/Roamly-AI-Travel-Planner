import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import config from "./config/index.mjs";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.mjs";
import { createApiRouter } from "./routes/apiRoutes.mjs";
import { databaseReady } from "./services/database.mjs";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(compression());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, error: { message: "Too many requests. Please try again shortly." } } }));
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || config.clientOrigins.includes(origin.replace(/\/$/, ""))),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  app.get("/api/health", (_request, response) => response.status(200).json({
    status: "ok",
    database: databaseReady() ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  }));
  app.use(createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}



 