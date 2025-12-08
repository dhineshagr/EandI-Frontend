import React, { useState, useMemo } from "react";

export default function RecentUploadsCard({ uploads }) {
  const [sortField, setSortField] = useState("uploaded_at_utc");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const API_BASE = "http://localhost:3001/api"; // ✅ backend base URL

  // ✅ Normalize backend keys to frontend-friendly fields
  const normalizedUploads = useMemo(
    () =>
      (uploads || []).map((u) => ({
        name: u.filename || u.name || "—",
        uploadedByName:
          u.uploaded_by_name || u.uploadedByName || u.uploaded_by || "—",
        date: u.uploaded_at_utc || u.date || null,
      })),
    [uploads]
  );

  // ✅ Sorting logic
  const sortedUploads = useMemo(() => {
    const sorted = [...normalizedUploads].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "uploaded_at_utc" || sortField === "date") {
        valA = new Date(valA);
        valB = new Date(valB);
      } else {
        valA = valA?.toString().toLowerCase();
        valB = valB?.toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [normalizedUploads, sortField, sortOrder]);

  // ✅ Pagination
  const totalPages = Math.ceil(sortedUploads.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedUploads = sortedUploads.slice(
    startIndex,
    startIndex + pageSize
  );

  const changeSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ✅ Secure backend download function
  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        alert("Unauthorized. Please login again.");
        return;
      }

      const response = await fetch(
        `${API_BASE}/uploads/download/${encodeURIComponent(filename)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("❌ Download error:", error.message);
      alert("Failed to download file. Please try again.");
    }
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border bg-white/90 shadow-md">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-transparent rounded-t-2xl">
        <h3 className="font-bold text-lg text-emerald-700">Recent Uploads</h3>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("name")}
              >
                File{" "}
                {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("uploadedByName")}
              >
                Uploaded By{" "}
                {sortField === "uploadedByName"
                  ? sortOrder === "asc"
                    ? "▲"
                    : "▼"
                  : ""}
              </th>
              <th
                className="border px-3 py-2 cursor-pointer hover:bg-slate-200"
                onClick={() => changeSort("date")}
              >
                Date{" "}
                {sortField === "date" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
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
              paginatedUploads.map((u, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => handleDownload(u.name)}
                      className="text-indigo-600 hover:underline text-left"
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

      {/* Pagination controls */}
      <div className="px-4 py-3 border-t bg-slate-50 text-sm rounded-b-2xl flex items-center justify-between">
        <div>
          Page {page} of {totalPages || 1}
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
            disabled={page === totalPages || totalPages === 0}
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
