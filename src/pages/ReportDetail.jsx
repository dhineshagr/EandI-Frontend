// src/pages/ReportDetail.jsx
// ======================================================================
// Report Detail Page (Okta SAML + Session-Based Auth)
// ----------------------------------------------------------------------
// ✔ No MSAL
// ✔ No frontend token handling
// ✔ Uses apiFetch() with session cookies
// ✔ No hardcoded backend URLs
// ✔ Displays multi-period report metadata
// ✔ All previous functionality preserved
// ======================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  FileText,
  Link,
  Loader,
  Save,
  User,
  XCircle,
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

  // Sorting and pagination
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ======================================================================
  // HELPERS
  // ======================================================================

  const getRowId = (row) =>
    row.Cur_Detail_ID ||
    row.Cur_Header_ID ||
    row.cur_id ||
    row.cur_detail_id ||
    row.id;

  const getRowStatus = (row) =>
    String(row?.DQ_Status || row?.dq_status || "")
      .trim()
      .toLowerCase();

  const getReportTypeDisplay = (report) => {
    const fileName = String(report?.filename || report?.file_name || "")
      .trim()
      .toUpperCase();

    if (fileName.startsWith("ZERO_SALES")) {
      return "Zero Sales";
    }

    const reportType = String(report?.report_type || "").trim();

    if (reportType.toLowerCase() === "members") {
      return "Report";
    }

    return reportType || "-";
  };

  const getPeriods = (report) => {
    if (Array.isArray(report?.periods) && report.periods.length > 0) {
      return report.periods
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    }

    if (report?.period) {
      return String(report.period)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    return [];
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  };

  const formatFieldLabel = (fieldName) => {
    if (String(fieldName).toUpperCase() === "CAF") {
      return "CAF %";
    }

    return String(fieldName)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  const getStatusStyle = (statusValue) => {
    const status = String(statusValue || "")
      .trim()
      .toLowerCase();

    if (status === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "failed") {
      return "bg-red-100 text-red-700";
    }

    if (status === "passed") {
      return "bg-blue-100 text-blue-700";
    }

    if (status === "validated") {
      return "bg-purple-100 text-purple-700";
    }

    if (
      ["new", "staged", "submitted", "pending", "processing"].includes(status)
    ) {
      return "bg-amber-100 text-amber-700";
    }

    return "bg-gray-100 text-gray-700";
  };

  const getStatusDisplay = (statusValue) => {
    const status = String(statusValue || "Pending")
      .trim()
      .toLowerCase();

    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // ======================================================================
  // FETCH REPORT SUMMARY AND ROWS
  // ======================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const summaryData = await apiFetch(
        apiUrl(`/reports/${reportNumber}/summary`),
      );

      const queryParams = new URLSearchParams();

      if (statusFilter) {
        queryParams.set("status", statusFilter);
      }

      if (dqFilter) {
        queryParams.set("dq", dqFilter);
      }

      const queryString = queryParams.toString();

      const rowsData = await apiFetch(
        apiUrl(
          `/reports/${reportNumber}/rows${
            queryString ? `?${queryString}` : ""
          }`,
        ),
      );

      setSummary(summaryData);
      setRows(Array.isArray(rowsData?.rows) ? rowsData.rows : []);
    } catch (err) {
      console.error("❌ Error loading report:", err);

      setSummary(null);
      setRows([]);

      alert("❌ Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, [reportNumber, statusFilter, dqFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ======================================================================
  // EDIT LOGIC
  // ======================================================================
  const startEdit = (row, field) => {
    const id = getRowId(row);

    if (!id) return;

    setEditing({
      cur_id: id,
      field,
      value: row[field] ?? "",
    });
  };

  const handleChange = (event) => {
    setEditing((previous) => ({
      ...previous,
      value: event.target.value,
    }));
  };

  const cancelEdit = () => {
    setEditing(null);
  };

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
      await fetchData();

      alert("✅ Row updated successfully");
    } catch (err) {
      console.error("❌ Save failed:", err);
      alert("❌ Failed to save changes.");
    }
  };

  // ======================================================================
  // APPROVAL
  // ======================================================================
  const approveReport = async () => {
    if (!window.confirm("Approve all rows in this report?")) {
      return;
    }

    try {
      await apiFetch(apiUrl(`/reports/${reportNumber}/approve`), {
        method: "PUT",
      });

      await fetchData();
      alert("✅ Report approved");
    } catch (err) {
      console.error("❌ Approve failed:", err);
      alert("❌ Failed to approve report.");
    }
  };

  const approveRow = async (curId) => {
    if (!curId) return;

    try {
      await apiFetch(apiUrl(`/reports/${reportNumber}/row/${curId}/approve`), {
        method: "PUT",
      });

      await fetchData();
      alert(`✅ Row ${curId} approved`);
    } catch (err) {
      console.error("❌ Row approve failed:", err);
      alert("❌ Failed to approve row.");
    }
  };

  // ======================================================================
  // SEARCH, SORTING AND PAGINATION
  // ======================================================================
  const processed = useMemo(() => {
    let list = [...rows];

    const searchValue = search.trim().toLowerCase();

    if (searchValue) {
      list = list.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(searchValue),
        ),
      );
    }

    if (sortField) {
      list.sort((leftRow, rightRow) => {
        const leftValue = leftRow[sortField] ?? "";
        const rightValue = rightRow[sortField] ?? "";

        const leftNumber = Number(leftValue);
        const rightNumber = Number(rightValue);

        const bothNumeric =
          leftValue !== "" &&
          rightValue !== "" &&
          Number.isFinite(leftNumber) &&
          Number.isFinite(rightNumber);

        if (bothNumeric) {
          return sortDir === "asc"
            ? leftNumber - rightNumber
            : rightNumber - leftNumber;
        }

        return sortDir === "asc"
          ? String(leftValue).localeCompare(String(rightValue))
          : String(rightValue).localeCompare(String(leftValue));
      });
    }

    const total = list.length;
    const startIndex = (page - 1) * pageSize;
    const slice = list.slice(startIndex, startIndex + pageSize);

    return {
      total,
      slice,
    };
  }, [rows, search, sortField, sortDir, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const toggleSort = (field) => {
    setPage(1);

    if (sortField === field) {
      setSortDir((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ======================================================================
  // LOADING AND ERROR STATES
  // ======================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-emerald-600" />
      </div>
    );
  }

  if (!summary?.report) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-red-500">❌ Report not found</div>
      </div>
    );
  }

  const report = summary.report;
  const counts = summary.counts || {};
  const periods = getPeriods(report);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const allRowsApproved =
    rows.length > 0 && rows.every((row) => getRowStatus(row) === "approved");

  const isZeroSales = getReportTypeDisplay(report) === "Zero Sales";

  // ======================================================================
  // MAIN UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      {/* PAGE HEADER */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="text-2xl font-bold flex flex-wrap items-center justify-center gap-3">
            Report #{report.report_number}
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusStyle(
                report.report_status,
              )}`}
            >
              {getStatusDisplay(report.report_status)}
            </span>
          </h1>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={approveReport}
              disabled={rows.length === 0 || allRowsApproved || isZeroSales}
              className={`px-4 py-2 rounded-lg text-white font-semibold ${
                rows.length === 0 || allRowsApproved || isZeroSales
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              title={
                isZeroSales
                  ? "Zero Sales declarations do not contain detail rows."
                  : rows.length === 0
                    ? "No rows are available to approve."
                    : allRowsApproved
                      ? "All rows are already approved."
                      : "Approve all rows"
              }
            >
              {allRowsApproved ? "Approved" : "Approve All"}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/reports/${reportNumber}/audit-log`)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Audit Trail
            </button>
          </div>
        </div>

        {/* REPORT METADATA */}
        <div className="bg-white shadow rounded-lg p-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetadataItem
              icon={<FileText className="h-5 w-5 text-slate-500" />}
              label="Report Type"
              value={getReportTypeDisplay(report)}
            />

            <MetadataItem
              icon={<CalendarDays className="h-5 w-5 text-slate-500" />}
              label="Period(s)"
              value={periods.length > 0 ? periods.join(", ") : "-"}
            />

            <MetadataItem label="Supplier" value={report.bp_code || "-"} />

            <MetadataItem label="Contract" value={report.contract_id || "-"} />

            <MetadataItem
              icon={<Link className="h-5 w-5 text-slate-500" />}
              label="Linked Report Number"
              value={report.related_report_number || "-"}
            />

            <MetadataItem
              icon={<User className="h-5 w-5 text-slate-500" />}
              label="Uploaded By"
              value={
                report.uploaded_by_display ||
                report.uploaded_by_name ||
                report.uploaded_by ||
                "System"
              }
            />

            <MetadataItem
              label="Uploaded Date"
              value={formatDate(report.uploaded_at_utc)}
            />

            <MetadataItem label="File Name" value={report.filename || "-"} />
          </div>
        </div>
      </div>

      {/* SUMMARY COUNTERS */}
      <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center gap-2">
          <FileText className="text-slate-600" />
          <span>Total: {counts.total_rows ?? 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <CheckCircle className="text-emerald-600" />
          <span>Passed: {counts.passed_count ?? 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <XCircle className="text-red-600" />
          <span>Failed: {counts.failed_count ?? 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <AlertTriangle className="text-purple-600" />
          <span>Validated: {counts.validated_count ?? 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <CheckCircle className="text-blue-600" />
          <span>Approved: {counts.approved_count ?? 0}</span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white shadow p-4 rounded-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <input
            type="text"
            placeholder="Search report rows..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="border p-2 rounded w-full lg:w-1/3"
          />

          <select
            className="border rounded px-3 py-2"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
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
            className="border rounded px-3 py-2"
            value={dqFilter}
            onChange={(event) => {
              setDqFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All DQ</option>
            <option value="ok">DQ OK</option>
            <option value="warning">DQ Warning</option>
            <option value="error">DQ Error</option>
          </select>

          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
          >
            Apply
          </button>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setDqFilter("");
              setPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </div>

      {/* DETAIL TABLE */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => toggleSort(column)}
                  className="px-3 py-2 border cursor-pointer select-none whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {formatFieldLabel(column)}

                    {sortField === column && (
                      <span className="text-xs">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </th>
              ))}

              <th className="px-3 py-2 border whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody>
            {processed.slice.map((row, index) => {
              const dqStatus = getRowStatus(row);
              const rowId = getRowId(row);

              return (
                <tr
                  key={rowId || `row-${index}`}
                  className={`hover:bg-slate-50 ${
                    dqStatus === "approved"
                      ? "bg-green-50 border-l-4 border-green-400"
                      : dqStatus === "failed"
                        ? "bg-red-50 border-l-4 border-red-400"
                        : dqStatus === "passed"
                          ? "bg-blue-50 border-l-4 border-blue-400"
                          : dqStatus === "validated"
                            ? "bg-purple-50 border-l-4 border-purple-400"
                            : ""
                  }`}
                >
                  {columns.map((column) => {
                    const isEditing =
                      editing?.cur_id === rowId && editing?.field === column;

                    return (
                      <td
                        key={`${rowId}-${column}`}
                        className="px-3 py-2 border align-top"
                      >
                        {isEditing ? (
                          <div className="flex min-w-52 gap-2">
                            <input
                              value={editing.value}
                              onChange={handleChange}
                              className="border rounded px-2 py-1 min-w-32"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveEdit();
                                }

                                if (event.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                            />

                            <button
                              type="button"
                              onClick={saveEdit}
                              className="bg-emerald-600 text-white px-2 rounded hover:bg-emerald-700"
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="border px-2 rounded hover:bg-slate-100"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(row, column)}
                            className="text-left w-full"
                            title="Click to edit"
                          >
                            {typeof row[column] === "object" &&
                            row[column] !== null
                              ? JSON.stringify(row[column])
                              : String(row[column] ?? "")}
                          </button>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 border whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => approveRow(rowId)}
                      disabled={dqStatus === "approved" || !rowId}
                      className={
                        dqStatus === "approved" || !rowId
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-emerald-600 hover:underline"
                      }
                    >
                      {dqStatus === "approved" ? "Approved" : "Approve"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {processed.slice.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(columns.length + 1, 1)}
                  className="text-center py-6 text-slate-500"
                >
                  {isZeroSales
                    ? "Zero Sales declaration has no detail rows."
                    : "No rows found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>

          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="border p-1 rounded"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <span className="text-sm text-gray-600 ml-3">
            {processed.total === 0
              ? "0–0 of 0"
              : `${(page - 1) * pageSize + 1}–${Math.min(
                  page * pageSize,
                  processed.total,
                )} of ${processed.total}`}
          </span>
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm">
            Page {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((previous) => Math.min(totalPages, previous + 1))
            }
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

/* ======================================================================
   METADATA ITEM
====================================================================== */
function MetadataItem({ icon = null, label, value }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>

      <div
        className="mt-1 font-medium text-slate-800 break-words"
        title={String(value ?? "-")}
      >
        {value ?? "-"}
      </div>
    </div>
  );
}
