import mongoose from "mongoose";

const savedItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  payload: mongoose.Schema.Types.Mixed,
}, { _id: false, timestamps: true });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  profilePicture: { type: String, default: "" },
  phoneNumber: { type: String, default: "", trim: true, maxlength: 25 },
  country: { type: String, default: "", trim: true, maxlength: 80 },
  preferredCurrency: { type: String, default: "USD", uppercase: true, maxlength: 3 },
  preferredLanguage: { type: String, default: "English", maxlength: 40 },
  favoriteDestinations: { type: [savedItemSchema], default: [] },
  savedTrips: { type: [savedItemSchema], default: [] },
  savedHotels: { type: [savedItemSchema], default: [] },
  savedRestaurants: { type: [savedItemSchema], default: [] },
  recentSearches: { type: [mongoose.Schema.Types.Mixed], default: [] },
  emailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
}, { timestamps: true, collection: "Users" });

userSchema.set("toJSON", {
  transform(_document, value) {
    delete value.password; delete value.resetPasswordToken; delete value.resetPasswordExpires; delete value.__v;
    return value;
  },
});

export const User = mongoose.models.User || mongoose.model("User", userSchema);
