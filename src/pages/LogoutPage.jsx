// src/pages/LogoutPage.jsx
import React, { useEffect } from "react";
import { apiPost } from "../api/apiClient";

export default function LogoutPage() {
  useEffect(() => {
    const logout = async () => {
      try {
        const res = await apiPost("/auth/logout");
        if (res?.redirect) {
          window.location.href = res.redirect;
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      }
    };

    logout();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Signing you out…
    </div>
  );
}
