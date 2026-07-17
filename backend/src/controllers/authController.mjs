import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import config from "../config/index.mjs";
import { User } from "../models/User.mjs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;
const publicUser = (user) => user.toJSON();
const cookieOptions = (remember = false) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", path: "/", maxAge: remember ? 30 * 864e5 : undefined });

function issueSession(response, user, remember) {
  if (!config.jwtSecret) throw new Error("JWT_SECRET must be configured.");
  const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: remember ? config.rememberMeExpiresIn : config.jwtExpiresIn });
  response.cookie("roamly_token", token, cookieOptions(remember));
  return token;
}

export async function register(request, response, next) {
  try {
    const { fullName, email = "", password, confirmPassword, rememberMe = false } = request.body;
    if (!fullName?.trim() || !emailPattern.test(email) || !strongPassword.test(password || "")) return response.status(400).json({ success: false, error: { message: "Enter a name, valid email, and a password with 8+ characters including uppercase, lowercase, number, and symbol." } });
    if (password !== confirmPassword) return response.status(400).json({ success: false, error: { message: "Passwords do not match." } });
    if (await User.exists({ email: email.toLowerCase().trim() })) return response.status(409).json({ success: false, error: { message: "An account with this email already exists." } });
    const user = await User.create({ fullName: fullName.trim(), email, password: await bcrypt.hash(password, 12) });
    const token = issueSession(response, user, rememberMe);
    response.status(201).json({ success: true, user: publicUser(user), token });
  } catch (error) { next(error); }
}

export async function login(request, response, next) {
  try {
    const { email = "", password = "", rememberMe = false } = request.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) return response.status(401).json({ success: false, error: { message: "Invalid email or password." } });
    const token = issueSession(response, user, rememberMe);
    user.password = undefined;
    response.json({ success: true, user: publicUser(user), token });
  } catch (error) { next(error); }
}

export function logout(_request, response) { response.clearCookie("roamly_token", cookieOptions()); response.json({ success: true }); }
export function me(request, response) { response.json({ success: true, user: publicUser(request.user) }); }

export async function updateProfile(request, response, next) {
  try {
    const allowed = ["fullName", "profilePicture", "phoneNumber", "country", "preferredCurrency", "preferredLanguage"];
    for (const key of allowed) if (request.body[key] !== undefined) request.user[key] = String(request.body[key]).trim();
    if (!request.user.fullName) return response.status(400).json({ success: false, error: { message: "Full name is required." } });
    await request.user.save(); response.json({ success: true, user: publicUser(request.user) });
  } catch (error) { next(error); }
}

export async function changePassword(request, response, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = request.body;
    const user = await User.findById(request.user.id).select("+password");
    if (!(await bcrypt.compare(currentPassword || "", user.password))) return response.status(400).json({ success: false, error: { message: "Current password is incorrect." } });
    if (!strongPassword.test(newPassword || "") || newPassword !== confirmPassword) return response.status(400).json({ success: false, error: { message: "New passwords must match and meet the strength requirements." } });
    user.password = await bcrypt.hash(newPassword, 12); await user.save(); response.json({ success: true, message: "Password changed successfully." });
  } catch (error) { next(error); }
}

export async function forgotPassword(request, response, next) {
  try {
    const user = await User.findOne({ email: String(request.body.email || "").toLowerCase().trim() }).select("+resetPasswordToken +resetPasswordExpires");
    let resetUrl;
    if (user) { const raw = crypto.randomBytes(32).toString("hex"); user.resetPasswordToken = crypto.createHash("sha256").update(raw).digest("hex"); user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; await user.save(); resetUrl = `${config.clientUrl}/reset-password/${raw}`; console.info(`[auth] Password reset requested for user ${user.id}. Configure an email provider to deliver the reset URL.`); }
    response.json({ success: true, message: "If that email exists, password reset instructions have been sent.", ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}) });
  } catch (error) { next(error); }
}

export async function resetPassword(request, response, next) {
  try {
    const { token, password, confirmPassword } = request.body;
    if (!strongPassword.test(password || "") || password !== confirmPassword) return response.status(400).json({ success: false, error: { message: "Passwords must match and meet the strength requirements." } });
    const digest = crypto.createHash("sha256").update(token || "").digest("hex");
    const user = await User.findOne({ resetPasswordToken: digest, resetPasswordExpires: { $gt: new Date() } }).select("+resetPasswordToken +resetPasswordExpires +password");
    if (!user) return response.status(400).json({ success: false, error: { message: "This reset link is invalid or has expired." } });
    user.password = await bcrypt.hash(password, 12); user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined; await user.save(); response.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) { next(error); }
}
