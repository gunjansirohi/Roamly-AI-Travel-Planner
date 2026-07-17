import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { changePassword, forgotPassword, login, logout, me, register, resetPassword, updateProfile } from "../controllers/authController.mjs";
import { requireAuth } from "../middleware/auth.mjs";

export function createAuthRouter() {
  const router = Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, error: { message: "Too many authentication attempts. Please try again later." } } });
  router.post("/register", authLimiter, register);
  router.post("/login", authLimiter, login);
  router.post("/logout", logout);
  router.get("/me", requireAuth, me);
  router.put("/profile", requireAuth, updateProfile);
  router.put("/change-password", authLimiter, requireAuth, changePassword);
  router.post("/forgot-password", authLimiter, forgotPassword);
  router.post("/reset-password", authLimiter, resetPassword);
  return router;
}
