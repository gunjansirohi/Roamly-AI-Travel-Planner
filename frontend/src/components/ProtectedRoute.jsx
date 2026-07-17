import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-loading"><span className="auth-spinner" />Checking your session…</main>;
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}
