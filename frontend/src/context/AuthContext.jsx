import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../config";

const AuthContext = createContext(null);

async function authRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(apiUrl(`/api/auth${path}`), { credentials: "include", headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  } catch {
    const error = new Error("Unable to reach the Roamly API. Start the app with npm start and try again.");
    error.code = "API_UNAVAILABLE";
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error?.message || "Something went wrong. Please try again."); error.code = payload.error?.code; throw error; }
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");
  useEffect(() => { authRequest("/me").then(({ user: value }) => setUser(value)).catch((error) => { if (error.code === "SESSION_EXPIRED") setSessionMessage("Your session expired. Please log in again."); }).finally(() => setLoading(false)); }, []);
  const authenticate = useCallback(async (mode, values) => { const payload = await authRequest(`/${mode}`, { method: "POST", body: JSON.stringify(values) }); setUser(payload.user); setSessionMessage(""); return payload; }, []);
  const logout = useCallback(async () => { try { await authRequest("/logout", { method: "POST" }); } finally { setUser(null); } }, []);
  const updateProfile = useCallback(async (values) => { const payload = await authRequest("/profile", { method: "PUT", body: JSON.stringify(values) }); setUser(payload.user); return payload; }, []);
  const value = useMemo(() => ({ user, loading, sessionMessage, clearSessionMessage: () => setSessionMessage(""), login: (values) => authenticate("login", values), register: (values) => authenticate("register", values), logout, updateProfile, request: authRequest }), [user, loading, sessionMessage, authenticate, logout, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }
