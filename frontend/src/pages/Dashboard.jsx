import { useAuth } from "../context/AuthContext";
import ApplicantDashboard from "./dashboard/ApplicantDashboard";
import OfficerDashboard from "./dashboard/OfficerDashboard";
import AdminDashboard from "./dashboard/AdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "officer") return <OfficerDashboard />;
  return <ApplicantDashboard />;
}
