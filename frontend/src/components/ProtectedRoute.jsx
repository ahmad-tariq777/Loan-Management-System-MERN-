import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./UI";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return children;
}
