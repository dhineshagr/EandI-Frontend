import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireInternal = false,
}) => {
  const { accounts, instance, inProgress } = useMsal();
  const location = useLocation();

  // 1) Wait until MSAL finishes login
  if (inProgress !== InteractionStatus.None) {
    return <div className="text-center p-8">Loading…</div>;
  }

  // 2) Get MSAL or external SQL account
  const account = instance.getActiveAccount?.() || accounts?.[0] || null;
  const extToken = localStorage.getItem("authToken");
  const extRoles = JSON.parse(localStorage.getItem("roles") || "[]");

  // 3) Not logged in → redirect to login
  if (!account && !extToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 4) Collect roles
  let roles = [];
  if (account) {
    const claims = account.idTokenClaims || {};
    roles = [...(claims.roles || []), ...(claims.appRoles || [])];
    if (claims.role && !roles.includes(claims.role)) {
      roles.push(claims.role);
    }
  } else if (extToken) {
    roles = Array.isArray(extRoles) ? extRoles : [];
  }

  console.log("🔐 Auth:", account ? "MSAL" : "SQL");
  console.log("🔐 Roles:", roles);

  // 5) Internal-only pages
  if (requireInternal) {
    const isInternal = roles.includes("Admin") || roles.includes("Accounting");
    if (!isInternal) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // 6) Role-based access (if provided)
  if (allowedRoles.length > 0) {
    const hasAccess = roles.some((r) => allowedRoles.includes(r));
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
