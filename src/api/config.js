// src/api/config.js

/**
 * ======================================================
 * Global API Configuration
 * ======================================================
 * All backend endpoints and URLs are centralized here.
 * Environment variables control behavior for:
 *   - Local development
 *   - Azure App Service
 *   - CI/CD deployment
 *
 * This ensures NO hardcoded URLs or scopes appear in components.
 */

// 🌐 Backend Base URL (from .env or fallback)
export const API_BASE =
  import.meta.env.VITE_API_BASE?.trim() || "http://localhost:3001/api";

// 📦 Azure Blob SAS URL (optional)
export const AZURE_BLOB_SAS_URL =
  import.meta.env.VITE_AZURE_BLOB_SAS_URL?.trim() || "";

// 🚀 External pipeline trigger URL (optional)
export const PIPELINE_TRIGGER_URL =
  import.meta.env.VITE_PIPELINE_TRIGGER_URL?.trim() || "";

/**
 * ======================================================
 * Helper: Build Full API URL
 * ======================================================
 * Ensures all API calls use consistent prefix.
 *
 * Usage:
 *   apiUrl("/reports/list")
 *   → "http://localhost:3001/api/reports/list"
 */
export function apiUrl(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${clean}`;
}

/**
 * ======================================================
 * Helper: Safe Fetch Wrapper
 * ======================================================
 * Automatically throws errors with readable messages.
 *
 * Usage:
 *   const data = await safeFetch(apiUrl("/reports/list"), { headers: {...} });
 */
export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);

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
 * Debug Log (only visible in browser console)
 */
console.log("✅ API_BASE =", API_BASE);
