import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiUrl } from "../api/config";

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireInternal = false,
}) => {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      setLoading(true);

      try {
        const res = await fetch(apiUrl("/me"), {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // ✅ Any non-OK means not authenticated (especially 401 after logout)
        if (!res.ok) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const data = await res.json().catch(() => null);

        // ✅ Support BOTH response shapes:
        // 1) { user: {...} }
        // 2) { authenticated: true, user: {...} }
        const resolvedUser =
          data?.user || (data?.authenticated && data?.user ? data.user : null);

        if (mounted) {
          setUser(resolvedUser || null);
        }
      } catch (err) {
        console.error("❌ Auth check failed", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUser();

    return () => {
      mounted = false;
    };
    // ✅ Re-check auth whenever route changes (prevents logout bounce-back)
  }, [location.pathname]);

  // ⏳ Loading
  if (loading) {
    return <div className="text-center p-8">Checking session…</div>;
  }

  // ❌ Not authenticated → go to login page ONLY
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🔐 Normalize role + user type
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const userType = String(user.user_type || "").toLowerCase(); // "internal" | "bp"

  // 🏢 Internal-only routes
  if (requireInternal && userType !== "internal") {
    return <Navigate to="/unauthorized" replace />;
  }

  // 🎭 Role-based routes (if used)
  if (allowedRoles.length > 0) {
    const hasAccess = roles.some((r) => allowedRoles.includes(r));
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ✅ Authorized
  return children;
};

export default ProtectedRoute;
