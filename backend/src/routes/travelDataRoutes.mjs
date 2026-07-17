import { Router } from "express";
import { requireAuth } from "../middleware/auth.mjs";
import { createTrip, dashboard, deleteSaved, deleteTrip, duplicateTrip, getTrip, listSaved, listTrips, recordSearch, saveProviderItem, toggleTripFavorite, updateTrip } from "../controllers/travelDataController.mjs";

export function createTravelDataRouter() {
  const router = Router();
  router.get("/trips", requireAuth, listTrips); router.post("/trips", requireAuth, createTrip); router.get("/trips/:id", requireAuth, getTrip); router.put("/trips/:id", requireAuth, updateTrip); router.delete("/trips/:id", requireAuth, deleteTrip); router.post("/trips/:id/duplicate", requireAuth, duplicateTrip); router.put("/trips/:id/favorite", requireAuth, toggleTripFavorite);
  router.get("/saved/:type", requireAuth, listSaved); router.post("/saved/:type", requireAuth, saveProviderItem); router.delete("/saved/:type/:providerId", requireAuth, deleteSaved);
  router.post("/search-history", requireAuth, recordSearch); router.get("/dashboard", requireAuth, dashboard);
  return router;
}
