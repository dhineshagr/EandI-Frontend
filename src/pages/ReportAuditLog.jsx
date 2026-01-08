// src/pages/ReportAuditLog.jsx
// ======================================================================
// Report Audit Log (Okta SAML + Session-Based Auth)
// ----------------------------------------------------------------------
// ✔ No MSAL
// ✔ No frontend token handling
// ✔ Uses apiFetch() with session cookies
// ✔ Preserves sorting, search, pagination, UI
// ======================================================================

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function ReportAuditLog() {
  const { reportNumber } = useParams();
  const navigate = useNavigate();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("changed_at_utc");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // -------------------------------------------------------------------
  // 📡 FETCH AUDIT LOG (Session-based)
  // -------------------------------------------------------------------
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(apiUrl(`/reports/${reportNumber}/audit-log`));
      setLogs(data.logs || []);
    } catch (err) {
      console.error("❌ Failed to load audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [reportNumber]);

  // -------------------------------------------------------------------
  // 🔍 SORTING + SEARCH HELPERS
  // -------------------------------------------------------------------
  const compareValues = (a, b) => {
    if (a === b) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    const dateA = Date.parse(a);
    const dateB = Date.parse(b);

    if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
    return String(a).localeCompare(String(b));
  };

  // -------------------------------------------------------------------
  // 🔎 SEARCH + SORT + PAGINATION (Memoized)
  // -------------------------------------------------------------------
  const processed = useMemo(() => {
    let list = [...logs];

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((log) =>
        [
          log.row_key,
          log.field_name,
          log.old_value,
          log.new_value,
          log.changed_by,
          log.change_reason,
          log.report_number,
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
      const cmp = compareValues(av, bv);
      return sortDir === "asc" ? cmp : -cmp;
    });

    const total = list.length;
    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    return { total, slice };
  }, [logs, search, sortField, sortDir, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

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

  // -------------------------------------------------------------------
  // ⏳ LOADING STATE
  // -------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6 text-slate-600 animate-pulse">Loading audit log…</div>
    );
  }

  // -------------------------------------------------------------------
  // 🎨 UI RENDER
  // -------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-slate-600 underline hover:text-slate-800"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold">Report #{reportNumber} — Audit Log</h1>

      {/* 🔍 Search */}
      <div className="bg-white shadow p-4 rounded flex gap-4 items-center">
        <input
          placeholder="Search field, value, or user..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border p-2 rounded w-1/3"
        />
      </div>

      {/* 📋 TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                { key: "audit_id", label: "ID" },
                { key: "report_number", label: "Report #" },
                { key: "row_key", label: "Row" },
                { key: "field_name", label: "Field" },
                { key: "old_value", label: "Old Value" },
                { key: "new_value", label: "New Value" },
                { key: "changed_by", label: "Changed By" },
                { key: "change_reason", label: "Reason" },
                { key: "changed_at_utc", label: "Changed At" },
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
            </tr>
          </thead>

          <tbody>
            {processed.slice.map((log) => (
              <tr key={log.audit_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 border">{log.audit_id}</td>
                <td className="px-3 py-2 border">{log.report_number}</td>
                <td className="px-3 py-2 border">{log.row_key}</td>
                <td className="px-3 py-2 border">{log.field_name}</td>
                <td className="px-3 py-2 border">
                  {log.old_value ?? <span className="text-slate-400">–</span>}
                </td>
                <td className="px-3 py-2 border">
                  {log.new_value ?? <span className="text-slate-400">–</span>}
                </td>
                <td className="px-3 py-2 border">{log.changed_by}</td>
                <td className="px-3 py-2 border">
                  {log.change_reason ?? (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
                <td className="px-3 py-2 border">
                  {log.changed_at_utc
                    ? new Date(log.changed_at_utc).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}

            {processed.slice.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center py-4 text-slate-500">
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📑 Pagination */}
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
