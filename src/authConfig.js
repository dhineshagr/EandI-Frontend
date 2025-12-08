/**
 * ======================================================
 * MSAL Authentication Configuration
 * ======================================================
 * - Reads all sensitive values from environment variables
 * - Centralizes API scopes
 * - Reused by apiClient.js and login components
 */

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin + "/login",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

/**
 * ======================================================
 * API SCOPES (Used globally)
 * ======================================================
 * Example:
 *   VITE_AZURE_API_SCOPE = api://xxxxxxx/access_as_user
 */

export const API_SCOPES = [
  import.meta.env.VITE_AZURE_API_SCOPE   // Your backend API scope
];

/**
 * ======================================================
 * Login request definition for MSAL
 * ======================================================
 */

export const loginRequest = {
  scopes: [
    ...API_SCOPES, // API permissions
    "openid",
    "profile",
    "email",
  ],
};
