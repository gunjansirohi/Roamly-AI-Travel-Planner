import mongoose from "mongoose";

const savedTripSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, prompt: { type: String, required: true }, itinerary: { type: String, required: true }, language: String }, { timestamps: true, collection: "SavedTrips" });
const favoriteSchema = new mongoose.Schema({ userId: { type: String, required: true, index: true }, placeId: { type: String, required: true }, payload: mongoose.Schema.Types.Mixed }, { timestamps: true });
favoriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });
const searchSchema = new mongoose.Schema({ userId: { type: String, default: "anonymous", index: true }, query: String, category: String }, { timestamps: true, collection: "RecentSearches" });

export const SavedTrip = mongoose.models.SavedTrip || mongoose.model("SavedTrip", savedTripSchema);
export const FavoriteHotel = mongoose.models.FavoriteHotel || mongoose.model("FavoriteHotel", favoriteSchema, "FavoriteHotels");
export const FavoriteRestaurant = mongoose.models.FavoriteRestaurant || mongoose.model("FavoriteRestaurant", favoriteSchema, "FavoriteRestaurants");
export const RecentSearch = mongoose.models.RecentSearch || mongoose.model("RecentSearch", searchSchema);

export async function connectDatabase(uri) {
  if (!uri) { console.info("[database] MongoDB not configured; persistence is disabled."); return false; }
  try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }); console.info("[database] MongoDB connected."); return true; }
  catch (error) { console.error("[database] MongoDB unavailable; continuing without persistence.", error.message); return false; }
}

export async function saveGeneratedTrip(record) {
  if (mongoose.connection.readyState !== 1) return;
  try { await SavedTrip.create(record); console.info("[database] itinerary saved"); }
  catch (error) { console.error("[database] itinerary persistence failed", error.message); }
}

export function databaseReady() { return mongoose.connection.readyState === 1; }

export async function saveRecentSearch(record) {
  if (!databaseReady()) return;
  try { await RecentSearch.create(record); console.info("[database] recent search saved"); }
  catch (error) { console.error("[database] recent search persistence failed", error.message); }
}

export async function setFavorite(kind, userId, placeId, payload) {
  if (!databaseReady()) return null;
  const Model = kind === "hotels" ? FavoriteHotel : FavoriteRestaurant;
  return Model.findOneAndUpdate({ userId, placeId }, { userId, placeId, payload }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

export async function removeFavorite(kind, userId, placeId) {
  if (!databaseReady()) return false;
  const Model = kind === "hotels" ? FavoriteHotel : FavoriteRestaurant;
  await Model.deleteOne({ userId, placeId });
  return true;
}

export async function listFavorites(kind, userId) {
  if (!databaseReady()) return [];
  const Model = kind === "hotels" ? FavoriteHotel : FavoriteRestaurant;
  return Model.find({ userId }).sort({ createdAt: -1 }).lean();
}
