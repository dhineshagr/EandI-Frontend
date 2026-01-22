import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";

import LoginPage from "./pages/LoginPage";
import UploadDashboard from "./pages/UploadDashboard";
import TemplatePage from "./pages/TemplatePage";
import ReportsDashboard from "./pages/ReportsDashboard";
import ReportDetail from "./pages/ReportDetail";
import LogoutPage from "./pages/LogoutPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage";
import ManageUsers from "./pages/ManageUsers";
import UserAuditLog from "./pages/UserAuditLog";
import ReportAuditLog from "./pages/ReportAuditLog";
import SspReportsDashboard from "./pages/SspReportsDashboard";

/* ===============================
   Layout with Header (Auth only)
================================ */
const AppLayout = () => (
  <>
    <Header />
    <Outlet />
  </>
);

/**
 * ✅ Public wrapper:
 * - keeps login pages clean
 * - avoids accidental redirect loops after logout
 *
 * Note: This does NOT replace your auth logic.
 * It just standardizes root path behavior.
 */
const PublicEntry = ({ children }) => {
  const location = useLocation();

  // If user lands on "/" we normalize to "/login"
  if (location.pathname === "/") {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* =========================
           PUBLIC ROUTES
        ========================== */}
        <Route
          path="/"
          element={
            <PublicEntry>
              <LoginPage />
            </PublicEntry>
          }
        />
        <Route
          path="/login"
          element={
            <PublicEntry>
              <LoginPage />
            </PublicEntry>
          }
        />

        {/* ✅ Logout must stay PUBLIC */}
        <Route path="/logout" element={<LogoutPage />} />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* =========================
           AUTHENTICATED ROUTES
        ========================== */}
        <Route element={<AppLayout />}>
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <UploadDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/template"
            element={
              <ProtectedRoute>
                <TemplatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute requireInternal>
                <ReportsDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ManageUsers"
            element={
              <ProtectedRoute requireInternal>
                <ManageUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/UserAuditLog"
            element={
              <ProtectedRoute requireInternal>
                <UserAuditLog />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports/:reportNumber/audit-log"
            element={
              <ProtectedRoute requireInternal>
                <ReportAuditLog />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ssp/reports"
            element={
              <ProtectedRoute requireInternal>
                <SspReportsDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports/:reportNumber"
            element={
              <ProtectedRoute>
                <ReportDetail />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* =========================
           FALLBACK
        ========================== */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
