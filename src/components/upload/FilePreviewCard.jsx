// src/components/upload/FilePreviewCard.jsx
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export default function FilePreviewCard({
  item,
  onUpload,
  disabled,
  userGroups = [], // 🔑 from /api/me (kept for backward compatibility)
  // ✅ NEW (recommended): pass from UploadDashboard so UI matches requirements
  userType, // "bp" | "internal"
  canViewValidationDetails, // true for Admin/Accounting/SSP_Admins
}) {
  const { name, preview, validation, status, progress, error } = item;
  const [showAllErrors, setShowAllErrors] = useState(false);

  // ================================
  // 🔐 Internal user detection (Okta-based)
  // ================================
  const groups = Array.isArray(userGroups) ? userGroups : [];

  const isInternalByGroups =
    groups.includes("SSP_Admins") ||
    groups.includes("SSP_Test") ||
    groups.includes("Admin") ||
    groups.includes("Internal");

  const isInternalByType = String(userType || "").toLowerCase() === "internal";

  // Keep old behavior working AND support new role gating
  const isInternal = isInternalByType || isInternalByGroups;

  // ================================
  // ✅ Who can see validation errors / error card?
  // - Per requirement: Only Admin + Accounting should see details
  // - If parent passes canViewValidationDetails, use it
  // - Else fall back to: internal users can see (backward compatible)
  // ================================
  const canSeeErrors = useMemo(() => {
    if (typeof canViewValidationDetails === "boolean")
      return canViewValidationDetails;
    return isInternal; // fallback (so we don’t break existing screens)
  }, [canViewValidationDetails, isInternal]);

  return (
    <div className="border rounded-xl bg-white p-4 shadow">
      {/* ================================
          Filename + Status Badge
      ================================= */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{name}</h3>

        {status === "ready" && (
          <span className="text-xs px-2 py-1 bg-slate-200 rounded">Ready</span>
        )}

        {status === "uploading" && (
          <span className="text-xs px-2 py-1 bg-blue-200 rounded flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
          </span>
        )}

        {status === "uploaded" && (
          <span className="text-xs px-2 py-1 bg-emerald-200 rounded flex items-center gap-1 text-emerald-800">
            <CheckCircle className="h-3 w-3" /> Uploaded
          </span>
        )}

        {/* ✅ Only show "Error" badge to Admin/Accounting (or internal fallback) */}
        {status === "error" && canSeeErrors && (
          <span className="text-xs px-2 py-1 bg-red-200 rounded flex items-center gap-1 text-red-800">
            <XCircle className="h-3 w-3" /> Error
          </span>
        )}
      </div>

      {/* ================================
          ✅ VALIDATION RESULTS
          - BP should NOT see error alerts/card/details
          - Admin/Accounting sees full error list
          - Everyone can still upload (button stays)
      ================================= */}
      {validation && (
        <div className="mt-2 text-sm">
          {/* ✅ Always show success message when ok */}
          {validation.ok ? (
            <p className="text-emerald-600">
              ✅ {validation.rowCount || 0} rows validated successfully
            </p>
          ) : (
            <>
              {/* ✅ If user is NOT allowed, hide the error section completely */}
              {canSeeErrors ? (
                <div className="text-red-600">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    {validation.errors?.length || 0} issue(s) found
                  </p>

                  <ul className="list-disc ml-6 text-xs mt-1 space-y-1">
                    {(showAllErrors
                      ? validation.errors
                      : (validation.errors || []).slice(0, 5)
                    ).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>

                  {validation.errors?.length > 5 && (
                    <button
                      onClick={() => setShowAllErrors(!showAllErrors)}
                      className="mt-2 text-xs text-indigo-600 underline"
                    >
                      {showAllErrors
                        ? "Show less"
                        : `Show more (${validation.errors.length - 5} more)`}
                    </button>
                  )}

                  <p className="text-xs text-slate-500 mt-2">
                    Note: The file can still be uploaded. Validation issues will
                    be emailed.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* ================================
          🔒 FILE PREVIEW (INTERNAL ONLY)
          - keep existing behavior
      ================================= */}
      {preview?.rows?.length > 0 && isInternal && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border">
            <thead>
              <tr>
                {preview.headers.map((h, i) => (
                  <th key={i} className="border px-2 py-1 bg-slate-100">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border px-2 py-1">
                      {cell ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-slate-500 mt-1">
            Showing first {preview.rows.length} rows
          </p>
        </div>
      )}

      {/* ================================
          Upload Progress + Error
      ================================= */}
      <div className="mt-3">
        {status === "uploading" && (
          <div className="w-full bg-slate-200 h-2 rounded mb-2">
            <div
              className="h-2 bg-blue-500 rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* ✅ ERROR MESSAGE (Admin/Accounting only; BP should not see it) */}
        {status === "error" && error && canSeeErrors && (
          <p className="text-xs text-red-600 mt-1">⚠ {error}</p>
        )}

        <button
          onClick={() => onUpload(item.id)}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 font-semibold disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> Upload to Azure
        </button>
      </div>
    </div>
  );
}
