// src/pages/LogoutPage.jsx
// ======================================================================
// Updated logout logic
// - Clears all local session data (authToken + userProfile)
// - Handles both Microsoft Entra and SQL-based logout flows
// - Uses MSAL redirect logout when applicable
// ======================================================================

import React, { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

export default function LogoutPage() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    console.log("🔄 Logging out…");

    // 🔹 Clear ALL locally stored authentication data
    localStorage.removeItem("authToken");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("roles");
    localStorage.removeItem("fullName");

    // 🔹 If logged in via Microsoft Entra (MSAL)
    if (accounts && accounts.length > 0) {
      console.log("🔒 Logging out of Microsoft Entra…");

      instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + "/login",
      });
    } else {
      // 🔹 SQL login → simple redirect
      console.log("🔒 SQL user logout → Redirecting to /login");
      window.location.replace("/login");
    }
  }, [instance, accounts]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Signing you out…
    </div>
  );
}
