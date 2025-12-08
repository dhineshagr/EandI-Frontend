// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

import { msalInstance } from "./msalInstance"; // ✅ centralized instance
import App from "./App";
import "./index.css";

// ✅ Sync active account when login or token acquisition succeeds
msalInstance.addEventCallback((event) => {
  if (
    event.eventType === EventType.LOGIN_SUCCESS ||
    event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
  ) {
    const account = event?.payload?.account;
    if (account) msalInstance.setActiveAccount(account);
  }
});

(async () => {
  try {
    // ✅ Initialize MSAL and handle redirects (login/logout)
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();

    // ✅ Restore existing session after refresh
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    // ✅ Render App with MSAL provider
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
    );
  } catch (err) {
    console.error("❌ MSAL initialization error:", err);
  }
})();
