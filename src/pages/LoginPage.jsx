// src/pages/LoginPage.jsx
// ======================================================================
// Updated for centralized API configuration
// - Removed hardcoded backend URLs
// - Uses apiUrl() from config.js
// - Keeps MSAL + SQL login flow intact
// ======================================================================

import React, { useEffect, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../authConfig";

import { apiUrl } from "../api/config";
import Logo from "../images/EI_Logo_Standard_2020.png";

export default function LoginPage() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  const [extUser, setExtUser] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already authenticated? → redirect
  useEffect(() => {
    if (isAuthenticated) navigate("/upload");
  }, [isAuthenticated, navigate]);

  // ----------------------------------------------------------------------
  // Internal Microsoft Entra login → backend token exchange
  // ----------------------------------------------------------------------
  const handleMsLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup(loginRequest);
      const idToken = loginResponse.idToken;

      const res = await fetch(apiUrl("/auth/entra-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Backend exchange failed");

      const data = await res.json();
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userProfile", JSON.stringify(data.user));

      navigate("/upload");
    } catch (err) {
      console.error("MSAL login failed:", err);
      setError("❌ Entra login failed");
    }
  };

  // ----------------------------------------------------------------------
  // External SQL login (business partner)
  // ----------------------------------------------------------------------
  const handleExternalLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extUser),
      });

      if (!res.ok) throw new Error("Invalid credentials");

      const data = await res.json();
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userProfile", JSON.stringify(data.user));

      navigate("/upload");
    } catch (err) {
      console.error("External login failed", err);
      setError("❌ Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-700 via-emerald-600 to-slate-800">
      <div className="w-full max-w-lg bg-white p-8 rounded-xl shadow-xl">
        <div className="flex justify-center mb-6">
          <img src={Logo} alt="E&I" className="h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center">Sign in</h1>

        {/* Internal Entra Login */}
        <div className="mt-6">
          <button
            onClick={handleMsLogin}
            className="w-full bg-gray-800 hover:bg-black text-white rounded-lg py-3 font-semibold"
          >
            Sign in with Microsoft Entra
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-grow border-t" />
          <span className="mx-3 text-gray-500">OR</span>
          <div className="flex-grow border-t" />
        </div>

        {/* External Login */}
        <form onSubmit={handleExternalLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={extUser.username}
            onChange={(e) =>
              setExtUser({ ...extUser, username: e.target.value })
            }
            className="w-full border rounded px-4 py-2"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={extUser.password}
            onChange={(e) =>
              setExtUser({ ...extUser, password: e.target.value })
            }
            className="w-full border rounded px-4 py-2"
            required
          />

          {error && <p className="text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white rounded-lg py-2 font-semibold"
          >
            {loading ? "Signing in..." : "Sign in with Username"}
          </button>
        </form>
      </div>
    </div>
  );
}
