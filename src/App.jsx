import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";

import UploadDashboard from "./pages/UploadDashboard";
import TemplatePage from "./pages/TemplatePage";
import ReportsDashboard from "./pages/ReportsDashboard";
import ReportDetail from "./pages/ReportDetail";
import LoginPage from "./pages/LoginPage";
import LogoutPage from "./pages/LogoutPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage";
import ManageUsers from "./pages/ManageUsers";
import UserAuditLog from "./pages/UserAuditLog";
import ReportAuditLog from "./pages/ReportAuditLog";
import SspReportsDashboard from "./pages/SspReportsDashboard";

// Layout with header for all authenticated pages
const AppLayout = () => (
  <>
    <Header />
    <Outlet />
  </>
);

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Routes with Header */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/upload" replace />} />

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
              <ProtectedRoute requireInternal={true}>
                <ReportsDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ManageUsers"
            element={
              <ProtectedRoute requireInternal={true}>
                <ManageUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/UserAuditLog"
            element={
              <ProtectedRoute>
                <UserAuditLog />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports/:reportNumber/audit-log"
            element={<ReportAuditLog />}
          />

          <Route path="/ssp/reports" element={<SspReportsDashboard />} />

          <Route
            path="/reports/:reportNumber"
            element={
              <ProtectedRoute>
                <ReportDetail />
              </ProtectedRoute>
            }
          />

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
        </Route>

        {/* No header for login/logout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutPage />} />

        {/* Catch-all – no header */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
