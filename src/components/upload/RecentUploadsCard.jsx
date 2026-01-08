import React, { useState, useMemo, useEffect } from "react";
import { apiUrl } from "../../api/config";

export default function RecentUploadsCard({ uploads }) {
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => setPage(1), [uploads]);

  // Normalize backend fields (add downloadKey)
  const normalizedUploads = useMemo(
    () =>
      (uploads || []).map((u) => ({
        name: u.filename || u.name || "—",
        uploadedByName:
          u.uploaded_by_name || u.uploadedByName || u.uploaded_by || "—",
        date: u.uploaded_at_utc || u.date || null,

        // ✅ Use backend-provided download_key FIRST (report_number)
        downloadKey:
          u.download_key ||
          u.upload_id ||
          u.blob_name ||
          u.storage_name ||
          u.file_path ||
          u.filename ||
          u.name,
      })),
    [uploads]
  );

  const sortedUploads = useMemo(() => {
    return [...normalizedUploads].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "date") {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else {
        valA = valA?.toString().toLowerCase() || "";
        valB = valB?.toString().toLowerCase() || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [normalizedUploads, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUploads.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedUploads = sortedUploads.slice(
    startIndex,
    startIndex + pageSize
  );

  const changeSort = (field) => {
    if (sortField === field)
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ✅ downloadKey supports either report_number (numeric) OR filename (string)
  const handleDownload = async (downloadKey, displayName) => {
    if (!downloadKey || downloadKey === "—") return;

    try {
      const isNumericId = String(downloadKey).match(/^\d+$/);

      const url = isNumericId
        ? apiUrl(`/uploads/download/${downloadKey}`)
        : apiUrl(`/uploads/download/${encodeURIComponent(downloadKey)}`);

      const response = await fetch(url, { credentials: "include" });

      if (response.status === 404) {
        alert(
          "File not found in storage (404). The record exists but the file may have been moved/deleted."
        );
        return;
      }

      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const blob = await response.blob();
      const fileName = displayName || "download";
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("❌ Download error:", error.message);
      alert("Failed to download file. Please try again.");
    }
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border bg-white/90 shadow-md">
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-transparent rounded-t-2xl">
        <h3 className="font-bold text-lg text-emerald-700">Recent Uploads</h3>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("name")}
              >
                File {sortField === "name" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("uploadedByName")}
              >
                Uploaded By{" "}
                {sortField === "uploadedByName" &&
                  (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("date")}
              >
                Date {sortField === "date" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedUploads.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center text-slate-500 py-4">
                  No uploads yet
                </td>
              </tr>
            ) : (
              paginatedUploads.map((u) => (
                <tr key={`${u.name}-${u.date}`} className="hover:bg-slate-50">
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => handleDownload(u.downloadKey, u.name)}
                      className="text-indigo-600 hover:underline text-left"
                      title={`downloadKey: ${u.downloadKey}`}
                    >
                      {u.name}
                    </button>
                  </td>
                  <td className="border px-3 py-2">{u.uploadedByName}</td>
                  <td className="border px-3 py-2">
                    {u.date ? new Date(u.date).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t bg-slate-50 text-sm rounded-b-2xl flex items-center justify-between">
        <div>
          Page {page} of {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border rounded px-2 py-1"
        >
          {[5, 10, 20].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
