import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Logo from "../images/EI_Logo_Standard_2020.png";
import { apiGet, apiPost } from "../api/apiClient";
import { apiUrl } from "../api/config"; // ✅ use env-driven base url

export default function LoginPage() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // ✅ SQL login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* =========================================
     Check existing backend session
  ========================================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = await apiGet("/me");
        if (result && mounted) {
          navigate("/upload", { replace: true });
        }
      } catch {
        // ignore (not logged in)
      } finally {
        if (mounted) setCheckingSession(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  /* =========================================
     Okta SAML Login (Internal Users)
  ========================================= */
  const handleSamlLogin = () => {
    // ✅ Redirect to backend SAML login using env-configured API base
    window.location.assign(apiUrl("/auth/saml/login"));
  };

  /* =========================================
     SQL Login (BP Users)
  ========================================= */
  const handleSqlLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiPost("/auth/sql/login", { username, password });
      navigate("/upload");
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-700 via-emerald-600 to-slate-800 text-white">
        Checking session…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-700 via-emerald-600 to-slate-800">
      <div className="w-full max-w-lg bg-white p-8 rounded-xl shadow-xl">
        <div className="flex justify-center mb-6">
          <img src={Logo} alt="E&I" className="h-12" />
        </div>

        <h1 className="text-2xl font-bold text-center">Sign in</h1>

        {/* OKTA LOGIN */}
        <div className="mt-6">
          <button
            onClick={handleSamlLogin}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-3 font-semibold"
          >
            Sign in with Okta
          </button>
        </div>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t" />
          <span className="mx-3 text-gray-500">OR</span>
          <div className="flex-grow border-t" />
        </div>

        {/* SQL LOGIN */}
        <form onSubmit={handleSqlLogin} className="space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full border rounded px-4 py-2"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border rounded px-4 py-2"
            required
          />

          {error && <p className="text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white rounded-lg py-2 font-semibold"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
