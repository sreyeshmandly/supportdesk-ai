import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PublicRoute() {
  const { isAuthenticated, checking } = useAuth();
  if (checking) return <div className="screen-loader"><span className="spinner" />Checking your session…</div>;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
