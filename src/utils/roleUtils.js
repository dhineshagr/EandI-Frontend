export const getUserRole = (account) => {
    if (!account || !account.idTokenClaims) return undefined;
  
    const roles = account.idTokenClaims.roles || account.idTokenClaims["roles"] || [];
  
    if (roles.includes("Admin")) return "Admin";
    if (roles.includes("Reviewer")) return "Reviewer";
    if (roles.includes("Clerk") || roles.includes("Contract Clerk")) return "Clerk";
  
    return "User"; // default fallback
  };
  