// src/pages/LogoutPage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api/apiClient";

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const logout = async () => {
      try {
        // ✅ Clear any possible client tokens (safe even if not used)
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("refresh_token");

        // ✅ Call backend logout (clears eandi.sid cookie + destroys session)
        const res = await apiPost("/auth/logout");

        // ✅ If backend wants Okta global logout, do a hard redirect
        if (res?.redirect) {
          window.location.assign(res.redirect);
          return;
        }

        // ✅ Otherwise route to login
        if (!cancelled) navigate("/login", { replace: true });
      } catch (e) {
        // Even if API fails, send user to login
        if (!cancelled) navigate("/login", { replace: true });
      }
    };

    logout();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Signing you out…
    </div>
  );
}
