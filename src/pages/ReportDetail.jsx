// src/pages/ReportDetail.jsx
// ======================================================================
// Report Detail Page (Okta SAML + Session-Based Auth)
// ----------------------------------------------------------------------
// ✔ No MSAL
// ✔ No frontend token handling
// ✔ Uses apiFetch() with session cookies
// ✔ NO hardcoded backend URLs
// ✔ All previous functionality preserved
// ======================================================================

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  ArrowLeft,
  Save,
} from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function ReportDetail() {
  const { reportNumber } = useParams();
  const navigate = useNavigate();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);

  const [statusFilter, setStatusFilter] = useState("");
  const [dqFilter, setDqFilter] = useState("");
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState(null);

  // Sorting & Pagination
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Row identity fallback logic
  const getRowId = (row) =>
    row.Cur_Detail_ID ||
    row.Cur_Header_ID ||
    row.cur_id ||
    row.cur_detail_id ||
    row.id;

  // ======================================================================
  // 📡 FETCH REPORT SUMMARY + ROWS (Session-based)
  // ======================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const summaryData = await apiFetch(
        apiUrl(`/reports/${reportNumber}/summary`)
      );

      const rowsData = await apiFetch(
        apiUrl(
          `/reports/${reportNumber}/rows?status=${statusFilter}&dq=${dqFilter}`
        )
      );

      setSummary(summaryData);
      setRows(rowsData.rows || []);
    } catch (err) {
      console.error("❌ Error loading report", err);
      alert("❌ Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, [reportNumber, statusFilter, dqFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ======================================================================
  // ✏️ EDIT LOGIC
  // ======================================================================
  const startEdit = (row, field) => {
    const id = getRowId(row);
    setEditing({
      cur_id: id,
      field,
      value: row[field] ?? "",
    });
  };

  const handleChange = (e) =>
    setEditing((prev) => ({ ...prev, value: e.target.value }));

  const saveEdit = async () => {
    if (!editing) return;

    try {
      await apiFetch(apiUrl(`/reports/${reportNumber}/row/${editing.cur_id}`), {
        method: "PUT",
        body: JSON.stringify({
          field_name: editing.field,
          new_value: editing.value,
          reason: "Manual correction",
        }),
      });

      setEditing(null);
      fetchData();
      alert("✅ Row updated successfully");
    } catch (err) {
      console.error("❌ Save failed", err);
      alert("❌ Failed to save changes.");
    }
  };

  // ======================================================================
  // ✔ APPROVE ITEMS
  // ======================================================================
  const approveReport = async () => {
    if (!window.confirm("Approve all rows in this report?")) return;

    try {
      await apiFetch(apiUrl(`/reports/${reportNumber}/approve`), {
        method: "PUT",
      });

      fetchData();
      alert("✅ Report approved");
    } catch (err) {
      console.error("❌ Approve failed", err);
      alert("❌ Failed to approve report.");
    }
  };

  const approveRow = async (curId) => {
    try {
      await apiFetch(apiUrl(`/reports/${reportNumber}/row/${curId}/approve`), {
        method: "PUT",
      });

      fetchData();
      alert(`✅ Row ${curId} approved`);
    } catch (err) {
      console.error("❌ Row approve failed", err);
      alert("❌ Failed to approve row.");
    }
  };

  // ======================================================================
  // 🔍 SEARCH + SORT + PAGINATION
  // ======================================================================
  const processed = useMemo(() => {
    let list = [...rows];

    // search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q)
        )
      );
    }

    // sort
    if (sortField) {
      list.sort((a, b) => {
        const av = a[sortField] ?? "";
        const bv = b[sortField] ?? "";

        if (!isNaN(av) && !isNaN(bv)) {
          return sortDir === "asc" ? av - bv : bv - av;
        }

        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    // pagination
    const total = list.length;
    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);

    return { total, slice };
  }, [rows, search, sortField, sortDir, page, pageSize]);

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

  // ======================================================================
  // ⏳ LOADING + ERROR STATES
  // ======================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-emerald-600" />
      </div>
    );
  }

  if (!summary || !summary.report) {
    return <div className="p-6 text-red-500">❌ Report not found</div>;
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];

  // ======================================================================
  // 🎨 MAIN UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold flex items-center gap-3">
          Report #{summary.report.report_number}
          <span
            className={`px-2 py-1 rounded text-sm font-semibold ${
              summary.report.report_status === "Approved"
                ? "bg-green-100 text-green-700"
                : summary.report.report_status === "Failed"
                ? "bg-red-100 text-red-700"
                : summary.report.report_status === "Passed"
                ? "bg-blue-100 text-blue-700"
                : summary.report.report_status === "Validated"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {summary.report.report_status}
          </span>
        </h1>

        <div className="flex gap-3">
          <button
            onClick={approveReport}
            disabled={rows.every(
              (r) => (r.dq_status || "").toLowerCase() === "approved"
            )}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${
              rows.every(
                (r) => (r.dq_status || "").toLowerCase() === "approved"
              )
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            Approve All
          </button>

          <button
            onClick={() => navigate(`/reports/${reportNumber}/audit-log`)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Audit Trail
          </button>
        </div>
      </div>

      {/* SUMMARY COUNTERS */}
      <div className="bg-white shadow rounded-lg p-4 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-emerald-600" />
          <span>Passed: {summary.counts?.passed_count ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="text-red-600" />
          <span>Failed: {summary.counts?.failed_count ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-600" />
          <span>Approved: {summary.counts?.approved_count ?? 0}</span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white shadow p-4 rounded flex gap-4 items-center">
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border p-2 rounded w-1/3"
        />

        <select
          className="border rounded px-2 py-1"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="approved">Approved</option>
          <option value="validated">Validated</option>
        </select>

        <select
          className="border rounded px-2 py-1"
          value={dqFilter}
          onChange={(e) => {
            setDqFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All DQ</option>
          <option value="ok">DQ OK</option>
          <option value="warning">DQ Warning</option>
          <option value="error">DQ Error</option>
        </select>

        <button
          onClick={fetchData}
          className="px-3 py-1 bg-slate-200 rounded hover:bg-slate-300"
        >
          Apply
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="px-3 py-2 border capitalize cursor-pointer select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.replace(/_/g, " ")}
                    {sortField === col && (
                      <span className="text-xs">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 border">Actions</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {processed.slice.map((row, idx) => {
              const dq = (row.DQ_Status || row.dq_status || "").toLowerCase();
              const rowId = getRowId(row);

              return (
                <tr
                  key={rowId || `r-${idx}`}
                  className={`hover:bg-slate-50 ${
                    dq === "approved"
                      ? "bg-green-50 border-l-4 border-green-400"
                      : dq === "failed"
                      ? "bg-red-50 border-l-4 border-red-400"
                      : dq === "passed"
                      ? "bg-blue-50 border-l-4 border-blue-400"
                      : dq === "validated"
                      ? "bg-purple-50 border-l-4 border-purple-400"
                      : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={`${rowId}-${col}`}
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => startEdit(row, col)}
                    >
                      {editing?.cur_id === rowId && editing?.field === col ? (
                        <div className="flex gap-2">
                          <input
                            value={editing.value}
                            onChange={handleChange}
                            className="border rounded px-2 py-1"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            className="bg-emerald-600 text-white px-2 rounded"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span>
                          {typeof row[col] === "object" && row[col] !== null
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? "")}
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="px-3 py-2 border">
                    <button
                      onClick={() => approveRow(rowId)}
                      disabled={dq === "approved"}
                      className={`${
                        dq === "approved"
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-emerald-600 hover:underline"
                      }`}
                    >
                      {dq === "approved" ? "Approved" : "Approve"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {processed.slice.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-center py-4 text-slate-500"
                >
                  No rows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
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
