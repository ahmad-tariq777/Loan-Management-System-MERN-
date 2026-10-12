import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import ApplyLoan from "./pages/ApplyLoan";
import MyLoans from "./pages/MyLoans";
import LoanDetail from "./pages/LoanDetail";
import MyInstallments from "./pages/MyInstallments";
import Payments from "./pages/Payments";
import AllLoans from "./pages/AllLoans";
import PendingLoans from "./pages/PendingLoans";
import Documents from "./pages/Documents";
import Applicants from "./pages/Applicants";
import ApplicantDetail from "./pages/ApplicantDetail";
import Overdue from "./pages/Overdue";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Officers from "./pages/Officers";
import Products from "./pages/Products";
import AuditLogs from "./pages/AuditLogs";

const APPLICANT = ["applicant"];
const STAFF = ["officer", "admin"];
const ADMIN = ["admin"];

function Page({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
          <Route path="/profile" element={<Page><Profile /></Page>} />
          <Route path="/notifications" element={<Page><Notifications /></Page>} />
          <Route path="/payments" element={<Page><Payments /></Page>} />
          <Route path="/loans/:id" element={<Page><LoanDetail /></Page>} />

          <Route path="/apply-loan" element={<Page roles={APPLICANT}><ApplyLoan /></Page>} />
          <Route path="/my-loans" element={<Page roles={APPLICANT}><MyLoans /></Page>} />
          <Route path="/my-installments" element={<Page roles={APPLICANT}><MyInstallments /></Page>} />

          <Route path="/pending-loans" element={<Page roles={STAFF}><PendingLoans /></Page>} />
          <Route path="/loans" element={<Page roles={STAFF}><AllLoans /></Page>} />
          <Route path="/documents" element={<Page roles={STAFF}><Documents /></Page>} />
          <Route path="/applicants" element={<Page roles={STAFF}><Applicants /></Page>} />
          <Route path="/applicants/:id" element={<Page roles={STAFF}><ApplicantDetail /></Page>} />
          <Route path="/overdue" element={<Page roles={STAFF}><Overdue /></Page>} />
          <Route path="/reports" element={<Page roles={STAFF}><Reports /></Page>} />

          <Route path="/users" element={<Page roles={ADMIN}><Users /></Page>} />
          <Route path="/users/:id" element={<Page roles={ADMIN}><UserDetail /></Page>} />
          <Route path="/officers" element={<Page roles={ADMIN}><Officers /></Page>} />
          <Route path="/products" element={<Page roles={ADMIN}><Products /></Page>} />
          <Route path="/audit-logs" element={<Page roles={ADMIN}><AuditLogs /></Page>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
