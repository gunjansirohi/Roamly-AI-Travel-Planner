import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

import { databaseReady } from "./services/database.mjs";
import { createApiRouter } from "./routes/apiRoutes.mjs";
import {
  notFoundHandler,
  errorHandler,
} from "./middleware/errorHandlers.mjs";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Allowed frontend origins
  const allowedOrigins = [
    "https://roamly-ai-travel-planner-t.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
  ];

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no Origin header
        // (health checks, server-to-server requests, etc.)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(
          new Error(`CORS blocked origin: ${origin}`)
        );
      },

      credentials: true,

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

      optionsSuccessStatus: 204,
      maxAge: 86400,
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

  // Compression
  app.use(compression());

  // Rate limiting
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
    response.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    response.setHeader(
      "X-Frame-Options",
      "DENY"
    );

    response.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );

    next();
  });

  // Body parsers
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      database: databaseReady()
        ? "connected"
        : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use(createApiRouter());

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}