// src/pages/SspReportsDashboard.jsx
// ======================================================================
// SSP Reports Dashboard (Okta SAML + Session-Based Auth)
// ----------------------------------------------------------------------
// ✔ No MSAL
// ✔ No bearer tokens
// ✔ Uses apiFetch() with secure session cookies
// ✔ No hardcoded API URLs
// ✔ Multi-period display support
// ✔ Friendly report type display: Members -> Report
// ✔ Zero Sales display and action handling
// ✔ Period / Supplier / Contract columns
// ✔ Linked Report # column
// ✔ Dynamic current-page totals for Purchase $ and CAF $
// ✔ Sticky/frozen table headers
// ✔ Show/hide columns with localStorage persistence
// ✔ Existing filters, sorting, export, download, and pagination preserved
// ======================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

const TABLE_COLUMNS = [
  { key: "report_number", label: "Report #" },
  { key: "related_report_number", label: "Linked Report #" },
  { key: "report_type", label: "Type" },
  { key: "file_name", label: "File" },
  { key: "period", label: "Period(s)" },
  { key: "supplier_name", label: "Supplier" },
  { key: "contract_id", label: "Contract" },
  { key: "uploaded_by_display", label: "Uploaded By" },
  { key: "uploaded_at_utc", label: "Uploaded At" },
  { key: "report_status", label: "Status" },
  { key: "passed_count", label: "Passed" },
  { key: "failed_count", label: "Failed" },
  { key: "approved_count", label: "Approved" },
  { key: "total_purchase", label: "Total Purchase $" },
  { key: "total_caf", label: "Total CAF $" },
  { key: "actions", label: "Actions", noSort: true },
];

const DEFAULT_VISIBLE_COLUMNS = TABLE_COLUMNS.reduce((result, column) => {
  result[column.key] = true;
  return result;
}, {});

const COLUMN_STORAGE_KEY = "sspReportsVisibleColumns";

const EMPTY_PAGE_TOTALS = {
  record_count: 0,
  total_purchase: 0,
  total_caf: 0,
};

export default function SspReportsDashboard() {
  const navigate = useNavigate();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageTotals, setPageTotals] = useState(EMPTY_PAGE_TOTALS);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    dateType: "Uploaded_At_Utc",
    startDate: "",
    endDate: "",
    supplier: "",
    contract: "",
    member: "",
  });

  const [sort, setSort] = useState({
    field: "uploaded_at_utc",
    order: "desc",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const savedColumns = localStorage.getItem(COLUMN_STORAGE_KEY);

      if (!savedColumns) {
        return DEFAULT_VISIBLE_COLUMNS;
      }

      return {
        ...DEFAULT_VISIBLE_COLUMNS,
        ...JSON.parse(savedColumns),
      };
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  // ======================================================================
  // HELPERS
  // ======================================================================

  const isZeroSalesReport = (report) =>
    String(report?.file_name || report?.filename || "")
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

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value) => {
    if (!value) return "-";

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "-";
      }

      return format(date, "MM/dd/yyyy HH:mm");
    } catch {
      return "-";
    }
  };

  const escapeCsvValue = (value) => {
    const text = String(value ?? "")
      .replace(/"/g, '""')
      .replace(/\r?\n/g, " ");

    return `"${text}"`;
  };

  // ======================================================================
  // COLUMN VISIBILITY
  // ======================================================================
  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch (err) {
      console.warn("Unable to save SSP dashboard column settings:", err);
    }
  }, [visibleColumns]);

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns((previous) => ({
      ...previous,
      [columnKey]: !previous[columnKey],
    }));
  };

  const showAllColumns = () => {
    setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS });
  };

  const visibleTableColumns = useMemo(
    () => TABLE_COLUMNS.filter((column) => visibleColumns[column.key]),
    [visibleColumns],
  );

  const visibleColumnCount = Math.max(1, visibleTableColumns.length);

  // ======================================================================
  // FETCH REPORTS
  // ======================================================================
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        search,
        dateType: filters.dateType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        supplier: filters.supplier,
        contract: filters.contract,
        member: filters.member,
        sort: sort.field,
        order: sort.order,
        page: String(page),
        limit: String(pageSize),
      });

      const data = await apiFetch(apiUrl(`/ssp/reports?${params.toString()}`));

      setReports(Array.isArray(data.reports) ? data.reports : []);
      setTotal(Number(data.total || 0));
      setPageTotals({
        record_count: Number(data.page_totals?.record_count || 0),
        total_purchase: Number(data.page_totals?.total_purchase || 0),
        total_caf: Number(data.page_totals?.total_caf || 0),
      });
    } catch (err) {
      console.error("❌ fetchReports error:", err);
      setReports([]);
      setTotal(0);
      setPageTotals(EMPTY_PAGE_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    filters.dateType,
    filters.startDate,
    filters.endDate,
    filters.supplier,
    filters.contract,
    filters.member,
    sort.field,
    sort.order,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ======================================================================
  // FILTER HANDLERS
  // ======================================================================
  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));

    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");

    setFilters({
      dateType: "Uploaded_At_Utc",
      startDate: "",
      endDate: "",
      supplier: "",
      contract: "",
      member: "",
    });

    setPage(1);
  };

  // ======================================================================
  // SORTING
  // ======================================================================
  const handleSort = (field) => {
    setPage(1);

    setSort((previous) => ({
      field,
      order:
        previous.field === field && previous.order === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortIcon = (field) => {
    if (sort.field !== field) return null;

    return (
      <span className="ml-1 text-xs">{sort.order === "asc" ? "▲" : "▼"}</span>
    );
  };

  // ======================================================================
  // EXPORT SUMMARY CSV
  // ======================================================================
  const handleExportSummary = () => {
    if (!reports.length) return;

    const headers = [
      "Report Number",
      "Linked Report Number",
      "Type",
      "File",
      "Periods",
      "Supplier",
      "Contract",
      "Uploaded By",
      "Uploaded At",
      "Status",
      "Passed Count",
      "Failed Count",
      "Approved Count",
      "Total Purchase",
      "Total CAF",
    ];

    const csvRows = reports.map((report) => [
      report.report_number,
      report.related_report_number || "",
      getReportTypeDisplay(report),
      report.file_name || "",
      getPeriodDisplay(report),
      report.supplier_name
        ? `${report.supplier_name} (${report.bp_code || ""})`
        : report.bp_code || "",
      report.contract_id || "",
      report.uploaded_by_display ||
        report.uploaded_by_name ||
        report.uploaded_by ||
        "System",
      formatDate(report.uploaded_at_utc),
      report.report_status || "",
      report.passed_count ?? 0,
      report.failed_count ?? 0,
      report.approved_count ?? 0,
      Number(report.total_purchase || 0).toFixed(2),
      Number(report.total_caf || 0).toFixed(2),
    ]);

    const csv = [
      headers.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = `ssp_reports_summary_${Date.now()}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(objectUrl);
  };

  // ======================================================================
  // DOWNLOAD REPORT DETAIL CSV
  // ======================================================================
  const handleDownloadDetail = async (reportNumber) => {
    try {
      const response = await fetch(
        apiUrl(`/ssp/reports/${reportNumber}/download`),
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `vrf_report_${reportNumber}.csv`;

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("❌ VRF download error:", err);
      alert("❌ Failed to download VRF CSV.");
    }
  };

  // ======================================================================
  // PAGINATION
  // ======================================================================
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // ======================================================================
  // UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold">SSP Reports Dashboard</h1>

        <p className="mt-1 text-slate-600">
          Search, review, export, and download processed SSP reports.
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by Report #, Linked Report #, File, Period, Supplier, Contract, or Uploaded By"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="border p-2 rounded col-span-2 md:col-span-4"
          />

          <select
            name="dateType"
            value={filters.dateType}
            onChange={handleFilterChange}
            className="border p-2 rounded"
          >
            <option value="Uploaded_At_Utc">Uploaded Date</option>
            <option value="Approved_At_Utc">Approved Date</option>
          </select>

          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="border p-2 rounded"
          />

          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="border p-2 rounded"
          />

          <button
            type="button"
            onClick={handleExportSummary}
            disabled={loading || reports.length === 0}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Export Summary CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            name="supplier"
            value={filters.supplier}
            onChange={handleFilterChange}
            placeholder="Filter by Supplier Name or Code"
            className="border p-2 rounded"
          />

          <input
            type="text"
            name="contract"
            value={filters.contract}
            onChange={handleFilterChange}
            placeholder="Filter by Contract ID"
            className="border p-2 rounded"
          />

          <input
            type="text"
            name="member"
            value={filters.member}
            onChange={handleFilterChange}
            placeholder="Filter by Member # or Name"
            className="border p-2 rounded"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnMenu((previous) => !previous)}
              className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-100"
            >
              Show / Hide Columns
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 z-50 mt-2 max-h-96 w-64 overflow-y-auto rounded border bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between border-b pb-2">
                  <span className="font-medium">Visible Columns</span>

                  <button
                    type="button"
                    onClick={showAllColumns}
                    className="text-xs text-blue-600 underline"
                  >
                    Show All
                  </button>
                </div>

                {TABLE_COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(visibleColumns[column.key])}
                      onChange={() => toggleColumnVisibility(column.key)}
                    />

                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-100"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* CURRENT PAGE TOTALS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Records on Current Page</div>
          <div className="mt-1 text-xl font-semibold">
            {pageTotals.record_count}
          </div>
        </div>

        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">
            Current Page Purchase Total
          </div>
          <div className="mt-1 text-xl font-semibold">
            ${formatMoney(pageTotals.total_purchase)}
          </div>
        </div>

        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Current Page CAF Total</div>
          <div className="mt-1 text-xl font-semibold">
            ${formatMoney(pageTotals.total_caf)}
          </div>
        </div>
      </div>

      {/* REPORT TABLE */}
      <div className="max-h-[65vh] overflow-auto rounded bg-white shadow">
        <table className="min-w-full border text-sm">
          <thead className="sticky top-0 z-20 bg-slate-100">
            <tr>
              {visibleTableColumns.map((column) => (
                <th
                  key={column.key}
                  onClick={
                    column.noSort ? undefined : () => handleSort(column.key)
                  }
                  className={`sticky top-0 z-20 border bg-slate-100 px-3 py-2 whitespace-nowrap ${
                    column.noSort
                      ? ""
                      : "cursor-pointer select-none hover:bg-slate-200"
                  }`}
                >
                  <span className="inline-flex items-center">
                    {column.label}
                    {!column.noSort && renderSortIcon(column.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="text-center py-6 text-slate-500"
                >
                  Loading reports...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="text-center py-6 text-slate-500"
                >
                  No reports found
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const status = String(report.report_status || "")
                  .trim()
                  .toLowerCase();

                const isZeroSales = isZeroSalesReport(report);

                const isProcessing = [
                  "submitted",
                  "pending",
                  "processing",
                  "new",
                  "staged",
                ].includes(status);

                const disableViewDetails = isProcessing || isZeroSales;
                const disableDownload = isProcessing || isZeroSales;

                return (
                  <tr key={report.report_number} className="hover:bg-slate-50">
                    {visibleColumns.report_number && (
                      <td className="border px-3 py-2">
                        {report.report_number}
                      </td>
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

                    {visibleColumns.file_name && (
                      <td className="border px-3 py-2">
                        {report.file_name || "-"}
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

                    {visibleColumns.supplier_name && (
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

                    {visibleColumns.uploaded_by_display && (
                      <td className="border px-3 py-2">
                        {report.uploaded_by_display ||
                          report.uploaded_by_name ||
                          report.uploaded_by ||
                          "System"}
                      </td>
                    )}

                    {visibleColumns.uploaded_at_utc && (
                      <td className="border px-3 py-2 whitespace-nowrap">
                        {formatDate(report.uploaded_at_utc)}
                      </td>
                    )}

                    {visibleColumns.report_status && (
                      <td className="border px-3 py-2 capitalize">
                        {status || "submitted"}
                      </td>
                    )}

                    {visibleColumns.passed_count && (
                      <td className="border px-3 py-2 text-center">
                        {report.passed_count ?? 0}
                      </td>
                    )}

                    {visibleColumns.failed_count && (
                      <td className="border px-3 py-2 text-center">
                        {report.failed_count ?? 0}
                      </td>
                    )}

                    {visibleColumns.approved_count && (
                      <td className="border px-3 py-2 text-center">
                        {report.approved_count ?? 0}
                      </td>
                    )}

                    {visibleColumns.total_purchase && (
                      <td className="border px-3 py-2 text-right whitespace-nowrap">
                        {formatMoney(report.total_purchase)}
                      </td>
                    )}

                    {visibleColumns.total_caf && (
                      <td className="border px-3 py-2 text-right whitespace-nowrap">
                        {formatMoney(report.total_caf)}
                      </td>
                    )}

                    {visibleColumns.actions && (
                      <td className="border px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (disableViewDetails) return;
                            navigate(`/reports/${report.report_number}`);
                          }}
                          disabled={disableViewDetails}
                          className={
                            disableViewDetails
                              ? "text-gray-400 cursor-not-allowed text-xs"
                              : "text-blue-600 text-xs underline"
                          }
                          title={
                            isZeroSales
                              ? "Zero Sales declaration has no detail rows."
                              : isProcessing
                                ? "Report is not ready yet."
                                : "View report details"
                          }
                        >
                          {isZeroSales
                            ? "Zero Sales Submitted"
                            : isProcessing
                              ? "Processing..."
                              : "View Details"}
                        </button>

                        <br />

                        <button
                          type="button"
                          onClick={() => {
                            if (disableDownload) return;
                            handleDownloadDetail(report.report_number);
                          }}
                          disabled={disableDownload}
                          className={
                            disableDownload
                              ? "text-gray-400 cursor-not-allowed text-xs"
                              : "text-emerald-600 text-xs underline"
                          }
                          title={
                            isZeroSales
                              ? "Zero Sales declaration has no VRF detail rows."
                              : isProcessing
                                ? "Report is not ready yet."
                                : "Download VRF CSV"
                          }
                        >
                          Download VRF CSV
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mt-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {total === 0 ? "0–0 of 0" : `${start}–${end} of ${total}`}
          </span>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={page === 1 || loading}
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
            disabled={page >= totalPages || loading}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
