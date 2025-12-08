// src/pages/SspReportsDashboard.jsx
// ======================================================================
// SSP Reports Dashboard (Production Ready)
// ----------------------------------------------------------------------
// ✔ Removes all hardcoded API URLs
// ✔ Uses centralized utilities (apiFetch, apiUrl)
// ✔ Uses centralized MSAL scopes (API_SCOPES)
// ✔ Token handling: Silent → Popup fallback
// ✔ Fully preserves all functionality (filters, search, pagination)
// ✔ Strong comments for future maintenance
// ======================================================================

import React, { useEffect, useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

// Shared centralized utilities
import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";
import { API_SCOPES } from "../authConfig";

export default function SspReportsDashboard() {
  const navigate = useNavigate();
  const { instance, accounts, inProgress } = useMsal();

  // -------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
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

  const popupInProgressRef = useRef(false);

  // ======================================================================
  // 🔐 GET ACCESS TOKEN
  // ======================================================================
  const getAccessToken = async () => {
    if (!accounts.length) return null;
    const account = accounts[0];

    try {
      // First attempt — silent
      const tokenResp = await instance.acquireTokenSilent({
        scopes: API_SCOPES,
        account,
      });
      return tokenResp.accessToken;
    } catch {
      // Silent failed → fall back to popup
      if (popupInProgressRef.current) return null;

      try {
        popupInProgressRef.current = true;

        const popupResp = await instance.acquireTokenPopup({
          scopes: API_SCOPES,
          account,
        });

        return popupResp.accessToken;
      } catch (err) {
        console.error("❌ acquireTokenPopup failed:", err.message);
        return null;
      } finally {
        popupInProgressRef.current = false;
      }
    }
  };

  // ======================================================================
  // 📄 LOAD REPORTS (CENTRALIZED API CALL)
  // ======================================================================
  const fetchReports = async () => {
    try {
      setLoading(true);

      const token = await getAccessToken();
      if (!token) {
        console.warn("⚠️ No token — cannot load SSP reports");
        setReports([]);
        setTotal(0);
        return;
      }

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
        page,
        limit: pageSize,
      });

      // Build final API URL using config
      const url = apiUrl(`/ssp/reports?${params.toString()}`);

      const data = await apiFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("❌ fetchReports error:", err);
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Reload on filter/pagination/sort change
  useEffect(() => {
    if (inProgress === "none" && accounts.length > 0) {
      fetchReports();
    }
  }, [inProgress, accounts, search, filters, sort, page, pageSize]);

  // ======================================================================
  // 🔧 FILTER & SORT HANDLERS
  // ======================================================================

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
    setPage(1);
  };

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  // ======================================================================
  // 📤 EXPORT SUMMARY CSV
  // ======================================================================
  const handleExportSummary = () => {
    if (!reports.length) return;

    const headers = Object.keys(reports[0]).join(",");
    const rows = reports.map((r) =>
      Object.values(r)
        .map((v) => `"${v ?? ""}"`)
        .join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ssp_reports_summary_${Date.now()}.csv`;
    a.click();
  };

  // ======================================================================
  // 📥 DOWNLOAD VRF DETAIL
  // ======================================================================
  const handleDownloadDetail = async (reportNumber) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const url = apiUrl(`/ssp/reports/${reportNumber}/download`);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Download failed ${res.status}`);

      const blob = await res.blob();
      const a = document.createElement("a");

      a.href = URL.createObjectURL(blob);
      a.download = `vrf_report_${reportNumber}.csv`;
      a.click();
    } catch (err) {
      console.error("❌ VRF download error:", err);
      alert("❌ Failed to download VRF CSV.");
    }
  };

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ======================================================================
  // 🎨 RENDER UI
  // ======================================================================

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">SSP Reports Dashboard</h1>

      {/* FILTER PANEL */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        {/* Search & Date Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <input
            placeholder="Search by Report #, File, or Uploaded By"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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
            onClick={handleExportSummary}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 col-span-2 md:col-span-1"
          >
            Export Summary CSV
          </button>
        </div>

        {/* Supplier / Contract / Member Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            name="supplier"
            value={filters.supplier}
            onChange={handleFilterChange}
            placeholder="Filter by Supplier (BP Code)"
            className="border p-2 rounded"
          />

          <input
            name="contract"
            value={filters.contract}
            onChange={handleFilterChange}
            placeholder="Filter by Contract ID"
            className="border p-2 rounded"
          />

          <input
            name="member"
            value={filters.member}
            onChange={handleFilterChange}
            placeholder="Filter by Member # / Name"
            className="border p-2 rounded"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                { key: "report_number", label: "Report #" },
                { key: "report_type", label: "Type" },
                { key: "file_name", label: "File" },
                { key: "uploaded_by", label: "Uploaded By" },
                { key: "uploaded_at_utc", label: "Uploaded At" },
                { key: "report_status", label: "Status" },
                { key: "passed_count", label: "Passed" },
                { key: "failed_count", label: "Failed" },
                { key: "approved_count", label: "Approved" },
                { key: "total_purchase", label: "Total Purchase $" },
                { key: "total_caf", label: "Total CAF $" },
                { key: "actions", label: "Actions", noSort: true },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={col.noSort ? undefined : () => handleSort(col.key)}
                  className={`px-3 py-2 border ${
                    col.noSort ? "" : "cursor-pointer select-none"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {!col.noSort && sort.field === col.key && (
                      <span className="text-xs">
                        {sort.order === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan="12" className="text-center py-4 text-slate-500">
                  No reports found
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.report_number} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border">{r.report_number}</td>
                  <td className="px-3 py-2 border">{r.report_type}</td>
                  <td className="px-3 py-2 border">{r.file_name}</td>
                  <td className="px-3 py-2 border">{r.uploaded_by}</td>

                  <td className="px-3 py-2 border">
                    {r.uploaded_at_utc
                      ? format(new Date(r.uploaded_at_utc), "MM/dd/yyyy HH:mm")
                      : ""}
                  </td>

                  <td className="px-3 py-2 border capitalize">
                    {r.report_status}
                  </td>

                  <td className="px-3 py-2 border text-center">
                    {r.passed_count}
                  </td>

                  <td className="px-3 py-2 border text-center">
                    {r.failed_count}
                  </td>

                  <td className="px-3 py-2 border text-center">
                    {r.approved_count}
                  </td>

                  <td className="px-3 py-2 border text-right">
                    {formatMoney(r.total_purchase)}
                  </td>

                  <td className="px-3 py-2 border text-right">
                    {formatMoney(r.total_caf)}
                  </td>

                  <td className="px-3 py-2 border">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => navigate(`/reports/${r.report_number}`)}
                        className="text-blue-600 hover:underline text-xs text-left"
                      >
                        View Details
                      </button>

                      <button
                        onClick={() => handleDownloadDetail(r.report_number)}
                        className="text-emerald-600 hover:underline text-xs text-left"
                      >
                        Download VRF CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span className="text-sm text-gray-600 ml-3">
            {total === 0 ? "0–0 of 0" : `${start}–${end} of ${total}`}
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
