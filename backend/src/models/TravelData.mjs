import mongoose from "mongoose";

const { Schema } = mongoose;
const owner = { type: Schema.Types.ObjectId, ref: "User", required: true, index: true };

const tripSchema = new Schema({
  userId: owner,
  destination: { type: String, required: true, trim: true, maxlength: 160 },
  startDate: Date,
  endDate: Date,
  budget: { type: Number, min: 0, default: 0 },
  currency: { type: String, uppercase: true, trim: true, maxlength: 3, default: "INR" },
  itinerary: { type: String, required: true },
  weatherSnapshot: Schema.Types.Mixed,
  selectedHotel: Schema.Types.Mixed,
  selectedRestaurant: Schema.Types.Mixed,
  selectedFlight: Schema.Types.Mixed,
  favorite: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ["draft", "planned", "completed"], default: "planned" },
}, { timestamps: true, collection: "Trips" });
tripSchema.index({ userId: 1, startDate: -1 });

function savedProviderSchema(collection) {
  const schema = new Schema({ userId: owner, providerId: { type: String, required: true }, data: { type: Schema.Types.Mixed, required: true } }, { timestamps: true, collection });
  schema.index({ userId: 1, providerId: 1 }, { unique: true });
  return schema;
}

const favoriteSchema = new Schema({ userId: owner, entityType: { type: String, enum: ["destination", "trip", "hotel", "restaurant", "flight"], required: true }, entityId: { type: String, required: true }, data: Schema.Types.Mixed }, { timestamps: true, collection: "Favorites" });
favoriteSchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });
const searchHistorySchema = new Schema({ userId: owner, query: { type: String, required: true, maxlength: 300 }, category: { type: String, enum: ["destination", "hotel", "restaurant", "flight", "trip"], required: true }, metadata: Schema.Types.Mixed }, { timestamps: true, collection: "SearchHistory" });
searchHistorySchema.index({ userId: 1, createdAt: -1 });

export const Trip = mongoose.models.Trip || mongoose.model("Trip", tripSchema);
export const Hotel = mongoose.models.Hotel || mongoose.model("Hotel", savedProviderSchema("Hotels"));
export const Restaurant = mongoose.models.Restaurant || mongoose.model("Restaurant", savedProviderSchema("Restaurants"));
export const Flight = mongoose.models.Flight || mongoose.model("Flight", savedProviderSchema("Flights"));
export const Favorite = mongoose.models.Favorite || mongoose.model("Favorite", favoriteSchema);
export const SearchHistory = mongoose.models.SearchHistory || mongoose.model("SearchHistory", searchHistorySchema);
