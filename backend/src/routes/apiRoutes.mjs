import { Router } from "express";

import { registerTravelRoutes } from "../controllers/travelController.mjs";

import { createAuthRouter } from "./authRoutes.mjs";

import { createTravelDataRouter } from "./travelDataRoutes.mjs";

export function createApiRouter() {
  const router = Router();

  router.use("/auth", createAuthRouter());

  router.use("/", createTravelDataRouter());

  registerTravelRoutes(router);

  return router;
}