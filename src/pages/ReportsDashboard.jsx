// src/pages/ReportsDashboard.jsx
// ✅ Add Passed + Pending handling (do NOT remove other logic)
// ✅ Disable “View Details” button for processing reports (pending/new/staged/submitted)
// ✅ Normalize status once per row to avoid case issues

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Loader,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

// 🔗 Centralized API utilities
import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function ReportsDashboard() {
  const navigate = useNavigate();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");

  // Sorting + Pagination
  const [sortField, setSortField] = useState("uploaded_at_utc");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ======================================================================
  // 📡 FETCH REPORTS (Session-based)
  // ======================================================================
  const fetchReports = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiFetch(apiUrl("/reports/list"));
      setReports(data.reports || []);
    } catch (err) {
      console.error("❌ Failed to load reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ======================================================================
  // 🔍 SEARCH + SORT + PAGINATION
  // ======================================================================
  const processed = useMemo(() => {
    let list = [...reports];

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((rep) =>
        [
          rep.filename,
          rep.uploaded_by,
          rep.status,
          rep.report_type,
          String(rep.report_number),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

    // Pagination
    const total = list.length;
    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    return { total, slice };
  }, [reports, search, sortField, sortDir, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

  // ======================================================================
  // 🔽 SORT HANDLER
  // ======================================================================
  const toggleSort = (field) => {
    setPage(1);
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const renderSortIcon = (field) =>
    sortField === field ? (
      <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  // ======================================================================
  // ⏳ LOADING
  // ======================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-emerald-600" />
      </div>
    );
  }

  // ======================================================================
  // 🎨 UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports Dashboard</h1>
      <p className="text-slate-600">
        List of uploaded reports with statuses, counts, and actions.
      </p>

      {/* Search */}
      <div className="bg-white shadow p-4 rounded flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by file, user, or report #"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2 w-1/3"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {[
                { key: "report_number", label: "Report #" },
                { key: "report_type", label: "Type" },
                { key: "filename", label: "File" },
                { key: "uploaded_by", label: "Uploaded By" },
                { key: "status", label: "Status" },
                { key: "uploaded_at_utc", label: "Uploaded At" },
                { key: "passed_count", label: "Passed" },
                { key: "failed_count", label: "Failed" },
                { key: "approved_count", label: "Approved" },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-3 py-2 border cursor-pointer select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {renderSortIcon(col.key)}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 border">Action</th>
            </tr>
          </thead>

          <tbody>
            {processed.slice.map((rep) => {
              // ✅ Normalize status once per row (prevents casing mismatches)
              const status = String(rep.status || "").toLowerCase();

              // ✅ Treat these as "still processing"
              const isProcessing = [
                "pending",
                "new",
                "staged",
                "submitted",
              ].includes(status);

              return (
                <tr key={rep.report_number} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border">{rep.report_number}</td>
                  <td className="px-3 py-2 border">{rep.report_type}</td>

                  <td className="px-3 py-2 border flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    {rep.filename}
                  </td>

                  <td className="px-3 py-2 border">
                    {rep.uploaded_by_display ||
                      rep.uploaded_by_name ||
                      rep.uploaded_by ||
                      "-"}
                  </td>

                  {/* ✅ Status (added passed + pending, kept everything else) */}
                  <td className="px-3 py-2 border">
                    {status === "approved" && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="h-4 w-4" /> Approved
                      </span>
                    )}

                    {status === "failed" && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" /> Failed
                      </span>
                    )}

                    {/* ✅ NEW: Passed */}
                    {status === "passed" && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <CheckCircle className="h-4 w-4" /> Passed
                      </span>
                    )}

                    {status === "submitted" && (
                      <span className="flex items-center gap-1 text-sky-600">
                        <CheckCircle className="h-4 w-4" /> Submitted
                      </span>
                    )}

                    {status === "validated" && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-4 w-4" /> Validated
                      </span>
                    )}

                    {["new", "staged"].includes(status) && (
                      <span className="text-slate-600 capitalize">
                        {status}
                      </span>
                    )}

                    {/* ✅ NEW: Pending (because backend returns 'pending' string) */}
                    {status === "pending" && (
                      <span className="text-slate-500">Pending</span>
                    )}

                    {/* Existing fallback */}
                    {!rep.status && (
                      <span className="text-slate-500">Pending</span>
                    )}
                  </td>

                  <td className="px-3 py-2 border">
                    {rep.uploaded_at_utc
                      ? new Date(rep.uploaded_at_utc).toLocaleString()
                      : "-"}
                  </td>

                  <td className="px-3 py-2 border">{rep.passed_count ?? 0}</td>
                  <td className="px-3 py-2 border">{rep.failed_count ?? 0}</td>
                  <td className="px-3 py-2 border">
                    {rep.approved_count ?? 0}
                  </td>

                  {/* ✅ Action: disable View Details when still processing */}
                  <td className="px-3 py-2 border">
                    <button
                      onClick={() => {
                        if (isProcessing) return;
                        navigate(`/reports/${rep.report_number}`);
                      }}
                      disabled={isProcessing}
                      className={
                        isProcessing
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-indigo-600 underline"
                      }
                      title={
                        isProcessing
                          ? "Report is still processing. Please wait and refresh."
                          : "View report details"
                      }
                    >
                      {isProcessing ? "Processing..." : "View Details"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {processed.slice.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center py-4 text-slate-500">
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border p-1 rounded"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <span className="text-sm text-gray-600 ml-3">
            {processed.total === 0
              ? "0–0 of 0"
              : `${(page - 1) * pageSize + 1}–${Math.min(
                  page * pageSize,
                  processed.total
                )} of ${processed.total}`}
          </span>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm">
            Page {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
