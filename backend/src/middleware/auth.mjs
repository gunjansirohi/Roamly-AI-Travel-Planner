import jwt from "jsonwebtoken";
import config from "../config/index.mjs";
import { User } from "../models/User.mjs";

export async function requireAuth(request, response, next) {
  try {
    const bearer = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
    const token = request.cookies?.roamly_token || bearer;
    if (!token) return response.status(401).json({ success: false, error: { code: "AUTH_REQUIRED", message: "Please log in to continue." } });
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return response.status(401).json({ success: false, error: { code: "SESSION_EXPIRED", message: "Your session has expired. Please log in again." } });
    request.user = user;
    next();
  } catch (error) {
    return response.status(401).json({ success: false, error: { code: "SESSION_EXPIRED", message: "Your session has expired. Please log in again." } });
  }
}
