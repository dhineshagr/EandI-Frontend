// src/pages/DeletedReportsAuditLog.jsx
// ======================================================================
// Deleted Reports Audit Log
// ----------------------------------------------------------------------
// ✔ Okta SAML + session-based authentication
// ✔ Uses apiFetch() with session cookies
// ✔ Search
// ✔ Report type filter
// ✔ Date filters
// ✔ Sorting
// ✔ Client-side pagination
// ✔ Sticky/frozen table header
// ✔ Horizontal and vertical scrolling
// ✔ No View Details page
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function DeletedReportsAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // ======================================================================
  // Filters
  // ======================================================================

  const [search, setSearch] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ======================================================================
  // Sorting and pagination
  // ======================================================================

  const [sortField, setSortField] = useState("deleted_at_utc");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ======================================================================
  // Fetch deleted report audit logs
  // ======================================================================

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await apiFetch(apiUrl("/report-delete-audit"));

      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (error) {
      console.error("❌ fetch deleted report audit logs error:", error);

      setLogs([]);
      setErrorMessage(
        error?.message || "Unable to load deleted reports audit logs.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // ======================================================================
  // Helpers
  // ======================================================================

  const getDeletedAt = (log) =>
    log.deleted_at_utc || log.deleted_at || log.created_at_utc || null;

  const normalizeValue = (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  };

  const compareValues = (a, b) => {
    const normalizedA = normalizeValue(a);
    const normalizedB = normalizeValue(b);

    if (normalizedA === normalizedB) {
      return 0;
    }

    if (normalizedA === null || normalizedA === "") {
      return -1;
    }

    if (normalizedB === null || normalizedB === "") {
      return 1;
    }

    const numericA = Number(normalizedA);
    const numericB = Number(normalizedB);

    const isNumericA = normalizedA !== "" && Number.isFinite(numericA);
    const isNumericB = normalizedB !== "" && Number.isFinite(numericB);

    if (isNumericA && isNumericB) {
      return numericA - numericB;
    }

    const dateA = Date.parse(normalizedA);
    const dateB = Date.parse(normalizedB);

    if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
      return dateA - dateB;
    }

    return String(normalizedA).localeCompare(String(normalizedB), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  };

  const formatDateTime = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  };

  const resetFilters = () => {
    setSearch("");
    setReportTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // ======================================================================
  // Report type filter options
  // ======================================================================

  const reportTypeOptions = useMemo(() => {
    const values = logs
      .map((log) => String(log.report_type || "").trim())
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b, undefined, {
        sensitivity: "base",
      }),
    );
  }, [logs]);

  // ======================================================================
  // Processing: search → filters → sort → pagination
  // ======================================================================

  const processed = useMemo(() => {
    let list = [...logs];

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------

    const searchText = search.trim().toLowerCase();

    if (searchText) {
      list = list.filter((log) => {
        const searchableValues = [
          log.report_delete_audit_id,
          log.report_number,
          log.filename,
          log.report_type,
          log.report_status,
          log.bp_code,
          log.period,
          log.delete_reason,
          log.deleted_by,
          log.deleted_by_role,
          log.contract_id,
        ];

        return searchableValues
          .filter(
            (value) =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== "",
          )
          .join(" ")
          .toLowerCase()
          .includes(searchText);
      });
    }

    // ------------------------------------------------------------------
    // Report type filter
    // ------------------------------------------------------------------

    if (reportTypeFilter) {
      list = list.filter(
        (log) =>
          String(log.report_type || "")
            .trim()
            .toLowerCase() === reportTypeFilter.trim().toLowerCase(),
      );
    }

    // ------------------------------------------------------------------
    // Date filters
    // ------------------------------------------------------------------

    if (dateFrom) {
      const fromDate = new Date(`${dateFrom}T00:00:00`);

      list = list.filter((log) => {
        const deletedAt = getDeletedAt(log);

        if (!deletedAt) {
          return false;
        }

        const logDate = new Date(deletedAt);

        return (
          !Number.isNaN(logDate.getTime()) &&
          logDate.getTime() >= fromDate.getTime()
        );
      });
    }

    if (dateTo) {
      const toDate = new Date(`${dateTo}T23:59:59.999`);

      list = list.filter((log) => {
        const deletedAt = getDeletedAt(log);

        if (!deletedAt) {
          return false;
        }

        const logDate = new Date(deletedAt);

        return (
          !Number.isNaN(logDate.getTime()) &&
          logDate.getTime() <= toDate.getTime()
        );
      });
    }

    // ------------------------------------------------------------------
    // Sorting
    // ------------------------------------------------------------------

    list.sort((a, b) => {
      let valueA;
      let valueB;

      switch (sortField) {
        case "deleted_at_utc":
          valueA = getDeletedAt(a);
          valueB = getDeletedAt(b);
          break;

        default:
          valueA = a[sortField];
          valueB = b[sortField];
          break;
      }

      const comparison = compareValues(valueA, valueB);

      return sortDir === "asc" ? comparison : -comparison;
    });

    // ------------------------------------------------------------------
    // Pagination
    // ------------------------------------------------------------------

    const total = list.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      total,
      slice: list.slice(startIndex, endIndex),
    };
  }, [
    logs,
    search,
    reportTypeFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDir,
    page,
    pageSize,
  ]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // ======================================================================
  // Sorting UI
  // ======================================================================

  const toggleSort = (field) => {
    setPage(1);

    if (sortField === field) {
      setSortDir((previous) => (previous === "asc" ? "desc" : "asc"));

      return;
    }

    setSortField(field);
    setSortDir("asc");
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return null;
    }

    return (
      <span className="text-xs" aria-hidden="true">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // ======================================================================
  // Table columns
  // ======================================================================

  const columns = [
    {
      key: "report_delete_audit_id",
      label: "ID",
      headerClassName: "min-w-[90px]",
    },
    {
      key: "report_number",
      label: "Report #",
      headerClassName: "min-w-[110px]",
    },
    {
      key: "filename",
      label: "File Name",
      headerClassName: "min-w-[260px]",
    },
    {
      key: "report_type",
      label: "Report Type",
      headerClassName: "min-w-[130px]",
    },
    {
      key: "report_status",
      label: "Status",
      headerClassName: "min-w-[110px]",
    },
    {
      key: "bp_code",
      label: "Supplier",
      headerClassName: "min-w-[120px]",
    },
    {
      key: "period",
      label: "Period",
      headerClassName: "min-w-[180px]",
    },
    {
      key: "delete_reason",
      label: "Delete Reason",
      headerClassName: "min-w-[280px]",
    },
    {
      key: "deleted_by",
      label: "Deleted By",
      headerClassName: "min-w-[240px]",
    },
    {
      key: "deleted_by_role",
      label: "Deleted Role",
      headerClassName: "min-w-[130px]",
    },
    {
      key: "deleted_at_utc",
      label: "Deleted At",
      headerClassName: "min-w-[190px]",
    },
  ];

  // ======================================================================
  // Loading
  // ======================================================================

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded bg-white p-6 shadow">
          Loading deleted reports audit logs...
        </div>
      </div>
    );
  }

  // ======================================================================
  // UI
  // ======================================================================

  return (
    <div className="space-y-6 p-6">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deleted Reports Audit Log</h1>

          <p className="mt-1 text-sm text-slate-500">
            Review reports that were permanently deleted from the application.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="
            rounded border border-slate-300 bg-white px-4 py-2
            text-sm font-medium text-slate-700
            hover:bg-slate-50
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          Refresh
        </button>
      </div>

      {/* ERROR MESSAGE */}
      {errorMessage && (
        <div
          className="
            rounded border border-red-200 bg-red-50 px-4 py-3
            text-sm text-red-700
          "
        >
          {errorMessage}
        </div>
      )}

      {/* FILTER BAR */}
      <div
        className="
          grid grid-cols-1 gap-4 rounded bg-white p-4 shadow
          md:grid-cols-2 xl:grid-cols-6
        "
      >
        <div className="md:col-span-2 xl:col-span-2">
          <label
            htmlFor="deleted-report-search"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Search
          </label>

          <input
            id="deleted-report-search"
            type="text"
            placeholder="Search report #, file, supplier, reason, deleted by..."
            className="w-full rounded border p-2"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label
            htmlFor="deleted-report-type"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Report Type
          </label>

          <select
            id="deleted-report-type"
            className="w-full rounded border p-2"
            value={reportTypeFilter}
            onChange={(event) => {
              setReportTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Report Types</option>

            {reportTypeOptions.map((reportType) => (
              <option key={reportType} value={reportType}>
                {reportType}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="deleted-report-date-from"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Deleted Date From
          </label>

          <input
            id="deleted-report-date-from"
            type="date"
            className="w-full rounded border p-2"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label
            htmlFor="deleted-report-date-to"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Deleted Date To
          </label>

          <input
            id="deleted-report-date-to"
            type="date"
            className="w-full rounded border p-2"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            className="
              w-full rounded border border-slate-300 bg-white px-4 py-2
              text-sm font-medium text-slate-700
              hover:bg-slate-50
            "
          >
            Clear
          </button>
        </div>
      </div>

      {/* RESULT SUMMARY */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Showing {processed.total} deleted report
          {processed.total === 1 ? "" : "s"}
        </p>

        {(search || reportTypeFilter || dateFrom || dateTo) && (
          <p className="text-sm text-slate-500">
            Filters are currently applied.
          </p>
        )}
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded bg-white shadow">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full border-collapse border text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    onClick={() => toggleSort(column.key)}
                    className={`
                      sticky top-0 z-20 border bg-slate-100 px-3 py-3
                      text-left font-semibold text-slate-700
                      cursor-pointer select-none whitespace-nowrap
                      ${column.headerClassName || ""}
                    `}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {renderSortIcon(column.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {processed.slice.map((log) => (
                <tr
                  key={log.report_delete_audit_id}
                  className="hover:bg-slate-50"
                >
                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.report_delete_audit_id ?? "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap font-medium">
                    {log.report_number ?? "-"}
                  </td>

                  <td
                    className="
                      max-w-[360px] border px-3 py-2
                      whitespace-normal break-words
                    "
                    title={log.filename || ""}
                  >
                    {log.filename || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.report_type || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.report_status || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.bp_code || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.period || "-"}
                  </td>

                  <td
                    className="
                      min-w-[280px] max-w-[440px] border px-3 py-2
                      whitespace-normal break-words
                    "
                  >
                    {log.delete_reason || "-"}
                  </td>

                  <td
                    className="
                      max-w-[300px] border px-3 py-2
                      whitespace-normal break-words
                    "
                  >
                    {log.deleted_by || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {log.deleted_by_role || "-"}
                  </td>

                  <td className="border px-3 py-2 whitespace-nowrap">
                    {formatDateTime(getDeletedAt(log))}
                  </td>
                </tr>
              ))}

              {processed.slice.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-8 text-center text-slate-500"
                  >
                    No deleted report audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="deleted-report-page-size"
            className="text-sm text-slate-600"
          >
            Rows per page:
          </label>

          <select
            id="deleted-report-page-size"
            className="rounded border p-1"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span className="ml-2 text-sm text-slate-600">
            {processed.total === 0
              ? "0–0 of 0"
              : `${(page - 1) * pageSize + 1}–${Math.min(
                  page * pageSize,
                  processed.total,
                )} of ${processed.total}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPage((currentPage) => Math.max(1, currentPage - 1))
            }
            disabled={page === 1}
            className="
              rounded border px-3 py-1
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            Prev
          </button>

          <span className="text-sm">
            Page {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((currentPage) => Math.min(totalPages, currentPage + 1))
            }
            disabled={page >= totalPages}
            className="
              rounded border px-3 py-1
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
