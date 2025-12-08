// src/api/apiClient.js

/**
 * ======================================================
 * API Client Wrapper (Production Ready)
 * ======================================================
 * All components use this file to call the backend securely.
 *
 * CHANGES IN THIS VERSION:
 *  - apiFetch() NO LONGER prefixes API_BASE automatically.
 *    (Prevents duplicate URLs like: /api/http://localhost:3001/api/...)
 *
 *  - Each caller must send a FULL URL or use apiUrl().
 *
 *  - Centralized token acquisition:
 *        MSAL → acquireTokenSilent()
 *        fallback → localStorage JWT (BP Login)
 *
 *  - Clean error handling and automatic login redirect
 * ======================================================
 */

import { msalInstance } from "../msalInstance";
import { loginRequest } from "../authConfig";
import { apiUrl } from "./config"; // optional helper

/**
 * Acquire a valid access token.
 * Attempts MSAL first, falls back to JWT stored in localStorage.
 */
async function getAccessToken() {
  const account =
    msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];

  if (!account) {
    console.warn("⚠️ No MSAL account found, falling back to local JWT");
    return localStorage.getItem("authToken") || null;
  }

  try {
    // Try silent token acquisition
    const result = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      scopes: [import.meta.env.VITE_AZURE_API_SCOPE],
      account,
    });

    return result.accessToken;
  } catch (err) {
    console.warn("⚠️ acquireTokenSilent failed:", err.message);

    // If interaction is required, redirect user to login
    if (
      err.errorCode === "interaction_required" ||
      (err.message || "").includes("interaction")
    ) {
      msalInstance.acquireTokenRedirect({
        ...loginRequest,
        scopes: [import.meta.env.VITE_AZURE_API_SCOPE],
      });
      return null; // execution will redirect
    }

    // fallback to JWT (BP login)
    return localStorage.getItem("authToken") || null;
  }
}

/**
 * ======================================================
 * apiFetch() - Centralized Wrapped Fetch
 * ======================================================
 * - Accepts FULL URL (not a path)
 * - Automatically attaches a Bearer token
 * - Auto parses JSON
 * - Throws normalized API errors
 */
export async function apiFetch(url, options = {}) {
  const token = await getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle non-2xx responses
  if (!response.ok) {
    const text = await response.text();
    console.error(`❌ API Error [${response.status}] on ${url}:`, text);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }

    throw new Error(`API ${response.status}: ${parsed.error || text}`);
  }

  // Parse response JSON
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Optional convenience wrapper:
 *
 * apiGet("/ssp/reports") → automatically uses apiUrl()
 */
export function apiGet(path) {
  return apiFetch(apiUrl(path));
}

export function apiPost(path, body = {}) {
  return apiFetch(apiUrl(path), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPut(path, body = {}) {
  return apiFetch(apiUrl(path), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete(path) {
  return apiFetch(apiUrl(path), { method: "DELETE" });
}
