/**
 * ======================================================
 * Authentication Configuration (Okta SAML – Session Based)
 * ======================================================
 * - NO MSAL
 * - NO client-side tokens
 * - Backend session (/api/me) is the source of truth
 * - Frontend only needs API base URL
 */

// Optional: central place for auth-related constants
export const AUTH_CONFIG = {
  authType: "OKTA_SAML_SESSION",
  sessionEndpoint: "/api/me",
  loginPath: "/login",
  logoutPath: "/logout",
};

/**
 * ⚠️ NOTE
 * - Access tokens are NOT handled in frontend
 * - Cookies are sent automatically via credentials: "include"
 * - Authorization is enforced by backend
 */
