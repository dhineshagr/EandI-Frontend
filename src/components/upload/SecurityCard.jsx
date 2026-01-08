import React from "react";
import { ShieldCheck } from "lucide-react";

/**
 * SecurityCard
 * Static information panel for the right column
 */
export default function SecurityCard() {
  return (
    <div className="rounded-2xl border backdrop-blur bg-white/80 shadow-md">
      <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-transparent">
        <h2 className="font-bold text-lg tracking-tight text-emerald-700 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Security
        </h2>
        <p className="text-sm text-slate-500 mt-1">Authentication & access</p>
      </div>

      <div className="p-5 text-sm text-slate-600 space-y-2">
        <p>
          • Sign-in via <strong>Okta SAML Single Sign-On</strong> with
          server-side session management.
        </p>
        <p>
          • No authentication tokens are stored in the browser; access is
          enforced using secure HTTP-only sessions.
        </p>
        <p>
          • Uploads use a <strong>container SAS URL</strong> configured via
          environment variables (no storage keys in code).
        </p>
        <p>
          • Files are stored under <code>members/YYYY/MM/DD</code> with
          timestamped names for traceability.
        </p>
      </div>
    </div>
  );
}
