// src/api/config.js

/**
 * ======================================================
 * Global API Configuration (Okta SAML / Session-Based)
 * ======================================================
 * Central place for backend URLs and external integrations.
 *
 * ENV USAGE:
 *  - Local:        http://localhost:3001
 *  - UAT / Prod:   https://ssp-api.eandi.org (example)
 *
 * IMPORTANT:
 *  - Auth handled via backend session (cookies)
 *  - No tokens or scopes referenced here
 */

// 🌐 Backend Base URL (NO /api here)
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3001";

// 📦 Azure Blob SAS URL (unchanged)
export const AZURE_BLOB_SAS_URL =
  import.meta.env.VITE_AZURE_BLOB_SAS_URL?.trim() || "";

// 🚀 External pipeline trigger URL (optional)
export const PIPELINE_TRIGGER_URL =
  import.meta.env.VITE_PIPELINE_TRIGGER_URL?.trim() || "";

/**
 * ======================================================
 * Helper: Build Full API URL
 * ======================================================
 * Always prefixes with /api
 *
 * Usage:
 *   apiUrl("/reports/list")
 *   → http://localhost:3001/api/reports/list
 */
export function apiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}/api${cleanPath}`;
}

/**
 * ======================================================
 * Helper: Safe Fetch Wrapper (optional utility)
 * ======================================================
 * NOTE:
 * - apiClient.js is the primary fetch wrapper
 * - This remains for utility or legacy usage
 */
export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include", // 🔑 session-based auth
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ HTTP ${response.status} Error:`, text);
      throw new Error(text || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("❌ API Fetch Failed:", err.message);
    throw err;
  }
}

/**
 * Debug Log (visible in browser console)
 */
console.log("✅ API_BASE =", API_BASE);
