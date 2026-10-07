import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

import config from "./config/index.mjs";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandlers.mjs";
import { createApiRouter } from "./routes/apiRoutes.mjs";
import { databaseReady } from "./services/database.mjs";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
    })
  );

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    })
  );

  app.use(compression());

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          message: "Too many requests. Please try again shortly.",
        },
      },
    })
  );

  // Additional security headers
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );
    next();
  });

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          "https://roamly-ai-travel-planner-t.vercel.app",
          "http://localhost:5173",
          "http://localhost:5174",
        ];

        // Allow requests without an Origin header
        // (health checks, server-to-server requests, etc.)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
      },

      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],

      allowedHeaders: [
        "Content-Type",
        "Authorization",
      ],

      credentials: true,

      optionsSuccessStatus: 204,

      maxAge: 86400,
    })
  );

  // Body parsers
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      database: databaseReady() ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  // IMPORTANT:
  // All API routes start with /api
  app.use("/api", createApiRouter());

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}