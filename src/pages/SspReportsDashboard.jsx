// src/pages/SspReportsDashboard.jsx
// ======================================================================
// SSP Reports Dashboard (Okta SAML + Session-Based Auth)
// ----------------------------------------------------------------------
// ✔ No MSAL
// ✔ No bearer tokens
// ✔ Uses apiFetch() with secure session cookies
// ✔ No hardcoded API URLs
// ✔ All existing functionality preserved
// ======================================================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

// Centralized API utilities
import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function SspReportsDashboard() {
  const navigate = useNavigate();

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

  // ======================================================================
  // 📄 LOAD REPORTS (Session-Based API)
  // ======================================================================
  const fetchReports = async () => {
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
        page,
        limit: pageSize,
      });

      const data = await apiFetch(apiUrl(`/ssp/reports?${params.toString()}`));

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

  // Reload on filter/sort/pagination change
  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, sort, page, pageSize]);

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
  // 📥 DOWNLOAD VRF DETAIL (Session-Based)
  // ======================================================================
  const handleDownloadDetail = async (reportNumber) => {
    try {
      const res = await fetch(apiUrl(`/ssp/reports/${reportNumber}/download`), {
        credentials: "include",
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
  // 🎨 UI
  // ======================================================================
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">SSP Reports Dashboard</h1>

      {/* FILTER PANEL */}
      <div className="bg-white p-4 rounded shadow space-y-4">
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
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
          >
            Export Summary CSV
          </button>
        </div>

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
                    col.noSort ? "" : "cursor-pointer"
                  }`}
                >
                  {col.label}
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
                  <td className="border px-3 py-2">{r.report_number}</td>
                  <td className="border px-3 py-2">{r.report_type}</td>
                  <td className="border px-3 py-2">{r.file_name}</td>

                  {/* ✅ FIX: show name instead of numeric user id */}
                  <td className="border px-3 py-2">
                    {r.uploaded_by_display ||
                      r.uploaded_by_name ||
                      r.uploaded_by ||
                      "System"}
                  </td>

                  <td className="border px-3 py-2">
                    {r.uploaded_at_utc
                      ? format(new Date(r.uploaded_at_utc), "MM/dd/yyyy HH:mm")
                      : ""}
                  </td>
                  <td className="border px-3 py-2 capitalize">
                    {r.report_status}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {r.passed_count}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {r.failed_count}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {r.approved_count}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {formatMoney(r.total_purchase)}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {formatMoney(r.total_caf)}
                  </td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => navigate(`/reports/${r.report_number}`)}
                      className="text-blue-600 text-xs underline"
                    >
                      View Details
                    </button>
                    <br />
                    <button
                      onClick={() => handleDownloadDetail(r.report_number)}
                      className="text-emerald-600 text-xs underline"
                    >
                      Download VRF CSV
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-600">
          {total === 0 ? "0–0 of 0" : `${start}–${end} of ${total}`}
        </span>

        <div className="flex gap-2">
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
