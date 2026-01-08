// src/utils/roleUtils.js
// =======================================================
// Role Utilities (Okta SAML + Session-Based Auth)
// -------------------------------------------------------
// ✔ No MSAL
// ✔ Reads roles from localStorage (set at login)
// ✔ Safe defaults
// =======================================================

export const getUserRole = () => {
  try {
    const stored = localStorage.getItem("roles");
    if (!stored) return "User";

    // Roles may be stored as JSON array or string
    const roles = Array.isArray(stored) ? stored : JSON.parse(stored);

    if (!Array.isArray(roles)) return "User";

    if (roles.includes("Admin")) return "Admin";
    if (roles.includes("Reviewer")) return "Reviewer";
    if (roles.includes("Clerk") || roles.includes("Contract Clerk"))
      return "Clerk";

    return "User";
  } catch (err) {
    console.warn("⚠️ Failed to read user roles:", err);
    return "User";
  }
};
