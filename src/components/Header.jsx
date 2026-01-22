// src/components/Header.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import logo1x from "../images/EI_Logo_Standard_2020.png";
import logo2x from "../images/EI_Logo_Standard_2020@2x.png";
import { apiGet } from "../api/apiClient";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // ✅ Fetch logged-in user (re-check whenever route changes)
  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const res = await apiGet("/me"); // apiFetch returns null on 401
        if (cancelled) return;

        if (!res || !res.user) {
          setUser(null);
          return;
        }

        setUser(res.user);
      } catch {
        if (!cancelled) setUser(null);
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // ✅ IMPORTANT: compute derived values BEFORE conditional return (no hooks here)
  const isBusinessPartner =
    String(user?.user_type || "").toLowerCase() === "bp";

  const roleBadge = isBusinessPartner
    ? "Business Partner"
    : user?.role || "Internal";

  const displayName =
    user?.display_name || user?.username || user?.email || "User";

  // Hide header if not authenticated
  if (!user) return null;

  // Nav active styling
  const isActive = (p) =>
    location.pathname === p || location.pathname.startsWith(p + "/")
      ? "text-white font-semibold border-b-2 border-white pb-1"
      : "text-white/80 hover:text-white";

  const handleLogout = () => {
    // ✅ Immediately drop user UI
    setUser(null);

    // ✅ Move to logout route without hard reload
    navigate("/logout", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 shadow-md">
      <div className="w-full bg-gradient-to-r from-teal-700 via-emerald-700 to-slate-800">
        <div className="h-14 px-6 flex items-center justify-between">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-8">
            <Link to="/upload" className="flex items-center">
              <img
                src={logo1x}
                srcSet={`${logo1x} 1x, ${logo2x || logo1x} 2x`}
                alt="E&I Cooperative Services"
                className="h-9 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = document.createElement("span");
                  fallback.textContent = "E&I";
                  fallback.className = "text-white font-bold text-lg";
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            </Link>

            <nav className="flex items-center gap-6 text-sm">
              <Link to="/upload" className={isActive("/upload")}>
                Upload
              </Link>
              <Link to="/template" className={isActive("/template")}>
                Template
              </Link>

              {/* 🔒 Internal-only menus */}
              {!isBusinessPartner && (
                <>
                  <Link to="/reports" className={isActive("/reports")}>
                    Reports
                  </Link>
                  <Link to="/ManageUsers" className={isActive("/ManageUsers")}>
                    Manage Users
                  </Link>
                  <Link
                    to="/UserAuditLog"
                    className={isActive("/UserAuditLog")}
                  >
                    User Audit Log
                  </Link>
                  <Link to="/ssp/reports" className={isActive("/ssp/reports")}>
                    SSP Reports Dashboard
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-sm text-white truncate max-w-[260px]">
              {displayName}
              <span className="ml-2 px-2 py-0.5 text-xs rounded bg-white/20 text-white">
                {roleBadge}
              </span>
            </span>

            <button
              type="button"
              className="px-3 py-1.5 rounded bg-white text-emerald-800 text-sm font-semibold hover:bg-slate-100 transition"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
