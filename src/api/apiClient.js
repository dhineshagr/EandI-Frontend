// src/api/apiClient.js
import { apiUrl } from "./config";

/**
 * ======================================================
 * apiFetch — SESSION SAFE
 * ======================================================
 */
export async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // REQUIRED
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null; // 👈 KEY FIX
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }

    throw new Error(parsed.error || `API ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* Convenience wrappers */

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
  return apiFetch(apiUrl(path), {
    method: "DELETE",
  });
}
