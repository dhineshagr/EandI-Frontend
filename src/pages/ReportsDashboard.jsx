// src/pages/ReportsDashboard.jsx
// ======================================================================
// Reports Dashboard
// ----------------------------------------------------------------------
// ✔ Session-based authentication
// ✔ Search, sorting, and client-side pagination
// ✔ Supplier name and supplier code display
// ✔ Multiple-period display
// ✔ Linked Report #
// ✔ Purchase and CAF totals for each report
// ✔ Dynamic totals for the current displayed page
// ✔ Sticky/frozen table header
// ✔ Show/hide columns with localStorage persistence
// ✔ Existing status derivation and Zero Sales behavior preserved
// ======================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Loader,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Columns3,
  ChevronDown,
  Trash2,
} from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

// ======================================================================
// COLUMN CONFIGURATION
// ======================================================================

const COLUMN_STORAGE_KEY = "reportsDashboardVisibleColumns";

const TABLE_COLUMNS = [
  { key: "report_number", label: "Report #" },
  { key: "related_report_number", label: "Linked Report #" },
  { key: "report_type", label: "Type" },
  { key: "filename", label: "File" },
  { key: "period", label: "Period" },
  { key: "supplier", label: "Supplier", sortKey: "supplier_name" },
  { key: "contract_id", label: "Contract" },
  {
    key: "uploaded_by",
    label: "Uploaded By",
    sortKey: "uploaded_by_display",
  },
  { key: "status", label: "Status" },
  { key: "uploaded_at_utc", label: "Uploaded At" },
  { key: "passed_count", label: "Passed" },
  { key: "failed_count", label: "Failed" },
  { key: "approved_count", label: "Approved" },
  { key: "total_purchase", label: "Total Purchase $" },
  { key: "total_caf", label: "Total CAF $" },
  { key: "action", label: "Action", noSort: true },
];

const createDefaultVisibleColumns = () =>
  TABLE_COLUMNS.reduce((columns, column) => {
    columns[column.key] = true;
    return columns;
  }, {});

const loadVisibleColumns = () => {
  const defaults = createDefaultVisibleColumns();

  try {
    const savedValue = window.localStorage.getItem(COLUMN_STORAGE_KEY);

    if (!savedValue) {
      return defaults;
    }

    const parsedValue = JSON.parse(savedValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return defaults;
    }

    return {
      ...defaults,
      ...parsedValue,

      // Keep the Action column available so users can open reports.
      action: true,
    };
  } catch (error) {
    console.warn("Unable to load Reports Dashboard column settings:", error);
    return defaults;
  }
};

export default function ReportsDashboard() {
  const navigate = useNavigate();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");

  // Sorting and pagination
  const [sortField, setSortField] = useState("uploaded_at_utc");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column visibility
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);

  // Delete report modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ======================================================================
  // HELPERS
  // ======================================================================

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getReportPeriods = (report) => {
    if (Array.isArray(report?.periods) && report.periods.length > 0) {
      return report.periods
        .map((period) => String(period || "").trim())
        .filter(Boolean);
    }

    if (report?.period) {
      return String(report.period)
        .split(",")
        .map((period) => period.trim())
        .filter(Boolean);
    }

    return [];
  };

  const getPeriodDisplay = (report) => {
    const periods = getReportPeriods(report);
    return periods.length > 0 ? periods.join(", ") : "-";
  };

  const isZeroSalesReport = (report) =>
    String(report?.filename || report?.file_name || "")
      .trim()
      .toUpperCase()
      .startsWith("ZERO_SALES");

  const getReportTypeDisplay = (report) => {
    if (isZeroSalesReport(report)) {
      return "Zero Sales";
    }

    const reportType = String(report?.report_type || "").trim();

    if (reportType.toLowerCase() === "members") {
      return "Report";
    }

    return reportType || "-";
  };

  const getUploadedByDisplay = (report) =>
    report?.uploaded_by_display ||
    report?.uploaded_by_name ||
    report?.uploaded_by ||
    "-";

  // ======================================================================
  // FETCH REPORTS
  // ======================================================================
  const fetchReports = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiFetch(apiUrl("/reports/list"));

      setReports(Array.isArray(data.reports) ? data.reports : []);
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
  // SAVE COLUMN VISIBILITY
  // ======================================================================
  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLUMN_STORAGE_KEY,
        JSON.stringify(visibleColumns),
      );
    } catch (error) {
      console.warn("Unable to save Reports Dashboard column settings:", error);
    }
  }, [visibleColumns]);

  // ======================================================================
  // SEARCH, SORT, AND PAGINATION
  // ======================================================================
  const processed = useMemo(() => {
    let list = [...reports];

    const queryValue = search.trim().toLowerCase();

    if (queryValue) {
      list = list.filter((report) =>
        [
          report.filename,
          report.uploaded_by,
          report.uploaded_by_display,
          report.uploaded_by_name,
          report.status,
          report.report_type,
          report.period,
          ...(Array.isArray(report.periods) ? report.periods : []),
          report.supplier_name,
          report.bp_code,
          report.contract_id,
          report.related_report_number,
          report.total_purchase,
          report.total_caf,
          String(report.report_number),
        ]
          .filter(
            (value) =>
              value !== undefined &&
              value !== null &&
              String(value).trim() !== "",
          )
          .join(" ")
          .toLowerCase()
          .includes(queryValue),
      );
    }

    list.sort((leftReport, rightReport) => {
      let leftValue;
      let rightValue;

      if (sortField === "supplier_name") {
        leftValue = leftReport.supplier_name || leftReport.bp_code || "";
        rightValue = rightReport.supplier_name || rightReport.bp_code || "";
      } else if (sortField === "uploaded_by_display") {
        leftValue = getUploadedByDisplay(leftReport);
        rightValue = getUploadedByDisplay(rightReport);
      } else {
        leftValue = leftReport[sortField] ?? "";
        rightValue = rightReport[sortField] ?? "";
      }

      const numericSortFields = [
        "report_number",
        "related_report_number",
        "passed_count",
        "failed_count",
        "approved_count",
        "total_purchase",
        "total_caf",
      ];

      if (numericSortFields.includes(sortField)) {
        const leftNumber = Number(leftValue || 0);
        const rightNumber = Number(rightValue || 0);

        return sortDir === "asc"
          ? leftNumber - rightNumber
          : rightNumber - leftNumber;
      }

      if (sortField === "uploaded_at_utc") {
        const leftTime = leftValue ? new Date(leftValue).getTime() : 0;
        const rightTime = rightValue ? new Date(rightValue).getTime() : 0;

        return sortDir === "asc" ? leftTime - rightTime : rightTime - leftTime;
      }

      return sortDir === "asc"
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });

    const total = list.length;
    const startIndex = (page - 1) * pageSize;
    const slice = list.slice(startIndex, startIndex + pageSize);

    return {
      total,
      slice,
    };
  }, [reports, search, sortField, sortDir, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // ======================================================================
  // CURRENT-PAGE TOTALS
  // ======================================================================
  const currentPageTotals = useMemo(
    () =>
      processed.slice.reduce(
        (totals, report) => {
          const purchase = Number(report.total_purchase || 0);
          const caf = Number(report.total_caf || 0);

          totals.total_purchase += Number.isFinite(purchase) ? purchase : 0;

          totals.total_caf += Number.isFinite(caf) ? caf : 0;

          return totals;
        },
        {
          total_purchase: 0,
          total_caf: 0,
        },
      ),
    [processed.slice],
  );

  // ======================================================================
  // SORTING
  // ======================================================================
  const toggleSort = (field) => {
    setPage(1);

    if (sortField === field) {
      setSortDir((previous) => (previous === "asc" ? "desc" : "asc"));
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
  // COLUMN VISIBILITY
  // ======================================================================
  const visibleTableColumns = TABLE_COLUMNS.filter(
    (column) => visibleColumns[column.key],
  );

  const visibleColumnCount = Math.max(1, visibleTableColumns.length);

  const toggleColumn = (columnKey) => {
    if (columnKey === "action") {
      return;
    }

    setVisibleColumns((previous) => ({
      ...previous,
      [columnKey]: !previous[columnKey],
    }));
  };

  const showAllColumns = () => {
    setVisibleColumns(createDefaultVisibleColumns());
  };

  const resetColumns = () => {
    setVisibleColumns(createDefaultVisibleColumns());
  };

  // ======================================================================
  // DELETE REPORT
  // ======================================================================
  const openDeleteModal = (report) => {
    setDeleteTarget(report);
    setDeleteReason("");
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
    setDeleteReason("");
    setDeleteError("");
  };

  const deleteReport = async () => {
    if (!deleteTarget?.report_number || deleting) {
      return;
    }

    const reason = deleteReason.trim();

    if (reason.length < 5) {
      setDeleteError(
        "Please enter a deletion reason with at least 5 characters.",
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await apiFetch(apiUrl(`/reports/${deleteTarget.report_number}`), {
        method: "DELETE",
        body: JSON.stringify({
          reason,
        }),
      });

      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteError("");

      await fetchReports();

      alert(
        `✅ Report #${deleteTarget.report_number} was deleted successfully.`,
      );
    } catch (error) {
      console.error("❌ Delete report failed:", error);

      setDeleteError(
        error?.message ||
          "The report could not be deleted. Please verify its status and try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ======================================================================
  // LOADING
  // ======================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-emerald-600" />
      </div>
    );
  }

  // ======================================================================
  // UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports Dashboard</h1>

        <p className="mt-1 text-slate-600">
          List of uploaded reports with statuses, counts, totals, and actions.
        </p>
      </div>

      {/* SEARCH AND COLUMN CONTROLS */}
      <div className="bg-white shadow p-4 rounded">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search by file, user, report #, linked report #, period, supplier, contract, Purchase $, or CAF $"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-2 w-full lg:w-2/3"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnMenu((previous) => !previous)}
              className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 rounded hover:bg-slate-100"
            >
              <Columns3 className="h-4 w-4" />
              Show / Hide Columns
              <ChevronDown className="h-4 w-4" />
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 z-40 mt-2 w-72 rounded border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">
                    Visible Columns
                  </span>

                  <button
                    type="button"
                    onClick={showAllColumns}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Show All
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {TABLE_COLUMNS.map((column) => (
                    <label
                      key={column.key}
                      className={`flex items-center gap-2 text-sm ${
                        column.key === "action"
                          ? "cursor-not-allowed text-slate-400"
                          : "cursor-pointer text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(visibleColumns[column.key])}
                        disabled={column.key === "action"}
                        onChange={() => toggleColumn(column.key)}
                      />

                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex justify-between border-t pt-3">
                  <button
                    type="button"
                    onClick={resetColumns}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowColumnMenu(false)}
                    className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CURRENT PAGE TOTALS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Records on Current Page</div>

          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {processed.slice.length}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">
            Current Page Purchase Total
          </div>

          <div className="mt-1 text-2xl font-semibold text-slate-900">
            ${formatMoney(currentPageTotals.total_purchase)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Current Page CAF Total</div>

          <div className="mt-1 text-2xl font-semibold text-slate-900">
            ${formatMoney(currentPageTotals.total_caf)}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="max-h-[65vh] overflow-auto rounded-lg bg-white shadow">
        <table className="min-w-full border text-sm">
          <thead className="sticky top-0 z-20 bg-slate-100 text-left shadow-sm">
            <tr>
              {visibleTableColumns.map((column) => {
                const sortKey = column.sortKey || column.key;

                return (
                  <th
                    key={column.key}
                    onClick={
                      column.noSort ? undefined : () => toggleSort(sortKey)
                    }
                    className={`border px-3 py-2 whitespace-nowrap ${
                      column.noSort
                        ? ""
                        : "cursor-pointer select-none hover:bg-slate-200"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}

                      {!column.noSort && renderSortIcon(sortKey)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {processed.slice.map((report) => {
              const rawStatus = String(report.status ?? "")
                .trim()
                .toLowerCase();

              const isZeroSales = isZeroSalesReport(report);

              const passedCount = Number(report.passed_count ?? 0);

              const failedCount = Number(report.failed_count ?? 0);

              const approvedCount = Number(report.approved_count ?? 0);

              const totalKnown = passedCount + failedCount + approvedCount;

              const processingLike = [
                "pending",
                "new",
                "staged",
                "submitted",
                "processing",
              ];

              const deriveStatusFromCounts = () => {
                if (isZeroSales) {
                  return rawStatus || "submitted";
                }

                if (failedCount > 0) {
                  return "failed";
                }

                if (totalKnown === 0) {
                  return rawStatus || "pending";
                }

                if (approvedCount > 0 && approvedCount === totalKnown) {
                  return "approved";
                }

                if (passedCount > 0 && passedCount === totalKnown) {
                  return "passed";
                }

                if (failedCount === 0 && passedCount + approvedCount > 0) {
                  return "passed";
                }

                return rawStatus || "pending";
              };

              const status = processingLike.includes(rawStatus)
                ? deriveStatusFromCounts()
                : rawStatus || deriveStatusFromCounts();

              const isProcessing = processingLike.includes(status);

              const disableViewDetails = isProcessing || isZeroSales;

              return (
                <tr key={report.report_number} className="hover:bg-slate-50">
                  {visibleColumns.report_number && (
                    <td className="border px-3 py-2">{report.report_number}</td>
                  )}

                  {visibleColumns.related_report_number && (
                    <td className="border px-3 py-2">
                      {report.related_report_number || "-"}
                    </td>
                  )}

                  {visibleColumns.report_type && (
                    <td className="border px-3 py-2">
                      {getReportTypeDisplay(report)}
                    </td>
                  )}

                  {visibleColumns.filename && (
                    <td className="border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />

                        <span>{report.filename || "-"}</span>
                      </div>
                    </td>
                  )}

                  {visibleColumns.period && (
                    <td className="border px-3 py-2">
                      <div
                        className="max-w-xs whitespace-normal"
                        title={getPeriodDisplay(report)}
                      >
                        {getPeriodDisplay(report)}
                      </div>
                    </td>
                  )}

                  {visibleColumns.supplier && (
                    <td className="border px-3 py-2">
                      <div>
                        <div className="font-medium">
                          {report.supplier_name || report.bp_code || "-"}
                        </div>

                        {report.supplier_name && report.bp_code && (
                          <div className="text-xs text-slate-500">
                            {report.bp_code}
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {visibleColumns.contract_id && (
                    <td className="border px-3 py-2">
                      {report.contract_id || "-"}
                    </td>
                  )}

                  {visibleColumns.uploaded_by && (
                    <td className="border px-3 py-2">
                      {getUploadedByDisplay(report)}
                    </td>
                  )}

                  {visibleColumns.status && (
                    <td className="border px-3 py-2">
                      {status === "approved" && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          Approved
                        </span>
                      )}

                      {status === "failed" && (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Failed
                        </span>
                      )}

                      {status === "passed" && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <CheckCircle className="h-4 w-4" />
                          Passed
                        </span>
                      )}

                      {status === "submitted" && (
                        <span className="flex items-center gap-1 text-sky-600">
                          <CheckCircle className="h-4 w-4" />
                          Submitted
                        </span>
                      )}

                      {status === "validated" && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          Validated
                        </span>
                      )}

                      {["new", "staged", "processing"].includes(status) && (
                        <span className="text-slate-600 capitalize">
                          {status}
                        </span>
                      )}

                      {status === "pending" && (
                        <span className="text-slate-500">Pending</span>
                      )}

                      {![
                        "approved",
                        "failed",
                        "passed",
                        "submitted",
                        "validated",
                        "new",
                        "staged",
                        "processing",
                        "pending",
                      ].includes(status) && (
                        <span className="text-slate-600 capitalize">
                          {status || "Pending"}
                        </span>
                      )}
                    </td>
                  )}

                  {visibleColumns.uploaded_at_utc && (
                    <td className="border px-3 py-2 whitespace-nowrap">
                      {report.uploaded_at_utc
                        ? new Date(report.uploaded_at_utc).toLocaleString()
                        : "-"}
                    </td>
                  )}

                  {visibleColumns.passed_count && (
                    <td className="border px-3 py-2 text-center">
                      {passedCount}
                    </td>
                  )}

                  {visibleColumns.failed_count && (
                    <td className="border px-3 py-2 text-center">
                      {failedCount}
                    </td>
                  )}

                  {visibleColumns.approved_count && (
                    <td className="border px-3 py-2 text-center">
                      {approvedCount}
                    </td>
                  )}

                  {visibleColumns.total_purchase && (
                    <td className="border px-3 py-2 text-right whitespace-nowrap">
                      ${formatMoney(report.total_purchase)}
                    </td>
                  )}

                  {visibleColumns.total_caf && (
                    <td className="border px-3 py-2 text-right whitespace-nowrap">
                      ${formatMoney(report.total_caf)}
                    </td>
                  )}

                  {visibleColumns.action && (
                    <td className="border px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (disableViewDetails) {
                              return;
                            }

                            navigate(`/reports/${report.report_number}`);
                          }}
                          disabled={disableViewDetails}
                          className={
                            disableViewDetails
                              ? "cursor-not-allowed text-gray-400"
                              : "text-indigo-600 underline"
                          }
                          title={
                            isZeroSales
                              ? "Zero Sales declaration has no detail rows."
                              : isProcessing
                                ? "Report is still processing. Please wait and refresh."
                                : "View report details"
                          }
                        >
                          {isZeroSales
                            ? "Zero Sales Submitted"
                            : isProcessing
                              ? "Processing..."
                              : "View Details"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(report)}
                          disabled={status === "approved"}
                          className={
                            status === "approved"
                              ? "inline-flex cursor-not-allowed items-center gap-1 text-gray-400"
                              : "inline-flex items-center gap-1 text-red-600 hover:underline"
                          }
                          title={
                            status === "approved"
                              ? "Approved reports cannot be deleted."
                              : "Delete this incorrect report"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {processed.slice.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="py-6 text-center text-slate-500"
                >
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>

          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded border p-1"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <span className="ml-3 text-sm text-gray-600">
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
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 disabled:opacity-50"
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
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* DELETE REPORT MODAL */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-report-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2
                id="delete-report-title"
                className="text-xl font-semibold text-slate-900"
              >
                Delete Report #{deleteTarget.report_number}
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                This permanently removes the report and its related data. This
                action cannot be undone.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                The report header, detail rows, staging rows, accounting-period
                mappings, and report audit entries will be deleted.
              </div>

              <div>
                <label
                  htmlFor="delete-report-reason"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Deletion reason
                </label>

                <textarea
                  id="delete-report-reason"
                  value={deleteReason}
                  onChange={(event) => {
                    setDeleteReason(event.target.value);
                    setDeleteError("");
                  }}
                  rows={4}
                  maxLength={500}
                  placeholder="Example: Incorrect supplier file was uploaded and must be reuploaded."
                  className="w-full rounded border border-slate-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  disabled={deleting}
                  autoFocus
                />

                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>Minimum 5 characters</span>
                  <span>{deleteReason.length}/500</span>
                </div>
              </div>

              {deleteError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteReport}
                disabled={deleting || deleteReason.trim().length < 5}
                className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
