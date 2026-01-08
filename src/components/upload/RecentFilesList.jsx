// RecentFilesList.jsx
import React from "react";
import { Trash2, UploadCloud } from "lucide-react";

/**
 * Props:
 * - items: array of uploaded files
 * - currentUser: { username, bpCode, groups }
 * - onStartUpload
 * - onRemove
 * - disabled
 * - flash
 */
export default function RecentFilesList({
  items,
  currentUser,
  onStartUpload,
  onRemove,
  disabled,
  flash,
}) {
  const groups = Array.isArray(currentUser?.groups) ? currentUser.groups : [];

  // 🔐 Internal user detection (Okta groups)
  const isInternal =
    groups.includes("SSP_Admins") ||
    groups.includes("SSP_Test") ||
    groups.includes("Internal");

  // 🔎 Filter items based on user role
  const visibleItems = isInternal
    ? items // Internal → see all
    : items.filter(
        (it) =>
          it.uploadedBy === currentUser?.username ||
          (currentUser?.bpCode && it.bpCode === currentUser.bpCode)
      );

  if (!visibleItems.length) {
    return (
      <div className="rounded-2xl border bg-white/80 p-4 text-slate-500 shadow">
        No uploads found
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white/80 shadow divide-y">
      {visibleItems.map((item) => (
        <div
          key={item.id}
          className={`flex items-center justify-between p-4 ${
            flash ? "animate-pulse bg-emerald-50" : ""
          }`}
        >
          <div>
            <p className="font-medium text-slate-800">{item.name}</p>
            <p className="text-xs text-slate-500">
              Uploaded by: {item.uploadedBy}
              {item.bpCode && ` • BP Code: ${item.bpCode}`}
            </p>
          </div>

          <div className="flex gap-2">
            {item.status === "ready" && (
              <button
                onClick={() => onStartUpload(item.id)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" /> Upload
              </button>
            )}

            <button
              onClick={() => onRemove(item.id)}
              className="inline-flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
