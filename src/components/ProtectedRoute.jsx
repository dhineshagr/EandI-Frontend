import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiUrl } from "../api/config";

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireInternal = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        const res = await fetch(apiUrl("/me"), {
          credentials: "include",
        });

        if (!res.ok) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const data = await res.json();

        if (mounted && data?.authenticated && data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
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
  }, []);

  // ⏳ Loading
  if (loading) {
    return <div className="text-center p-8">Checking session…</div>;
  }

  // ❌ Not authenticated → go to login page ONLY
  if (!user) {
    // ❌ NO AUTO REDIRECT
    return <Navigate to="/login" replace />;
  }

  // 🔐 Normalize role + user type
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const userType = user.user_type; // "internal" | "bp"

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
