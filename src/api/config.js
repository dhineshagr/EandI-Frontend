// src/api/config.js

/**
 * ======================================================
 * Global API Configuration (Okta SAML / Session-Based)
 * ======================================================
 * Central place for backend URLs and external integrations.
 *
 * IMPORTANT (Vite):
 * - VITE_* variables are injected at BUILD TIME.
 * - Do NOT keep localhost fallbacks for Azure builds, or you’ll silently ship localhost.
 *
 * Required:
 *   VITE_API_BASE_URL = https://<your-backend-app>.azurewebsites.net
 *   (NO /api, NO trailing slash)
 */

// ------------------------------------------------------
// ✅ Backend Base URL (NO /api here)
// ------------------------------------------------------
export const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, ""); // strip trailing slashes

if (!API_BASE) {
  throw new Error(
    "Missing VITE_API_BASE_URL (frontend env var). Example: https://eni-ssp-backend-dev-xxxx.azurewebsites.net"
  );
}

// ------------------------------------------------------
// Optional integrations
// ------------------------------------------------------
export const AZURE_BLOB_SAS_URL = String(
  import.meta.env.VITE_AZURE_BLOB_SAS_URL || ""
).trim();

export const PIPELINE_TRIGGER_URL = String(
  import.meta.env.VITE_PIPELINE_TRIGGER_URL || ""
).trim();

// ------------------------------------------------------
// Helper: Build Full API URL (always prefixes with /api)
// Usage: apiUrl('/reports/list') -> `${API_BASE}/api/reports/list`
// ------------------------------------------------------
export function apiUrl(path) {
  const cleanPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${API_BASE}/api${cleanPath}`;
}

// ------------------------------------------------------
// Helper: Safe Fetch Wrapper (utility / legacy)
// NOTE: apiClient.js is your primary fetch wrapper.
// ------------------------------------------------------
export async function safeFetch(url, options = {}) {
  const finalUrl = String(url || "");
  if (!finalUrl) throw new Error("safeFetch called with empty url");

  const response = await fetch(finalUrl, {
    ...options,
    credentials: "include", // ✅ session-based auth
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`❌ HTTP ${response.status} Error:`, text);
    throw new Error(text || `HTTP ${response.status}`);
  }

  // Some endpoints may return empty 204
  if (response.status === 204) return null;

  // Attempt JSON parse
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  // Fallback to text
  return await response.text();
}

// ------------------------------------------------------
// Debug log (visible in browser console)
// ------------------------------------------------------
console.log("✅ API_BASE =", API_BASE);
