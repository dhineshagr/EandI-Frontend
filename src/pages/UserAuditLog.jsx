// src/pages/UserAuditLog.jsx
// ======================================================================
// User Audit Log (Updated to new API architecture)
// ----------------------------------------------------------------------
// ✔ Removed hardcoded API URL
// ✔ Using apiUrl() + apiFetch() for all backend calls
// ✔ Fully compatible with MSAL token flow
// ✔ Preserved ALL existing functionality
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function UserAuditLog() {
  const { instance, accounts } = useMsal();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔍 Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // 🔽 Sorting & Pagination
  const [sortField, setSortField] = useState("changed_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ======================================================================
  // MSAL Token helper (used by apiFetch fallback)
  // ======================================================================
  const getAccessToken = async () => {
    if (!instance || accounts.length === 0) return null;

    try {
      const account = accounts[0];
      const tokenResp = await instance.acquireTokenSilent({
        scopes: ["api://e5614425-4dbe-4f35-b725-64b9a2b92827/access_as_user"],
        account,
      });
      return tokenResp.accessToken;
    } catch {
      return null;
    }
  };

  // ======================================================================
  // FETCH AUDIT LOG
  // ======================================================================
  const fetchLogs = async () => {
    setLoading(true);
    try {
      // apiFetch will attach token automatically
      const data = await apiFetch(apiUrl("/users/audit/logs"));
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("❌ fetchLogs error", err);
      setLogs([]);
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
  const getChangedAt = (log) =>
    log.changed_at || log.created_at_utc || log.updated_at_utc || null;

  const compareValues = (a, b) => {
    if (a === b) return 0;
    if (a === null) return -1;
    if (b === null) return 1;

    // Date comparison
    const da = Date.parse(a);
    const db = Date.parse(b);
    if (!isNaN(da) && !isNaN(db)) return da - db;

    return String(a).localeCompare(String(b));
  };

  // ======================================================================
  // PROCESSING: search → filters → sort → pagination
  // ======================================================================
  const processed = useMemo(() => {
    let list = [...logs];

    // 🔍 Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((x) =>
        [
          x.username,
          x.email,
          x.changed_by,
          x.action,
          JSON.stringify(x.old_values),
          JSON.stringify(x.new_values),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    // Action filter
    if (actionFilter) {
      list = list.filter((x) => x.action === actionFilter);
    }

    // Date filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((x) => {
        const dt = getChangedAt(x);
        return dt ? new Date(dt) >= from : false;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((x) => {
        const dt = getChangedAt(x);
        return dt ? new Date(dt) <= to : false;
      });
    }

    // Sorting
    list.sort((a, b) => {
      let av, bv;

      switch (sortField) {
        case "old_values":
        case "new_values":
          av = JSON.stringify(a[sortField] || "");
          bv = JSON.stringify(b[sortField] || "");
          break;

        case "changed_at":
          av = getChangedAt(a);
          bv = getChangedAt(b);
          break;

        default:
          av = a[sortField] || null;
          bv = b[sortField] || null;
      }

      const cmp = compareValues(av, bv);
      return sortDir === "asc" ? cmp : -cmp;
    });

    // Pagination
    const total = list.length;
    const start = (page - 1) * pageSize;
    return {
      total,
      slice: list.slice(start, start + pageSize),
    };
  }, [
    logs,
    search,
    actionFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDir,
    page,
    pageSize,
  ]);

  const totalPages = Math.max(1, Math.ceil(processed.total / pageSize));

  // Sorting UI
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
  // UI
  // ======================================================================
  if (loading) return <div className="p-6">Loading audit logs...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">User Audit Log</h1>

      {/* FILTER BAR */}
      <div className="bg-white shadow p-4 rounded grid grid-cols-5 gap-4">
        <input
          placeholder="Search users, email, changed by..."
          className="border p-2 rounded col-span-2"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <select
          className="border p-2 rounded"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="enable">Enable</option>
          <option value="disable">Disable</option>
          <option value="delete">Delete</option>
        </select>

        <div className="flex gap-2 col-span-2">
          <input
            type="date"
            className="border p-2 rounded"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />

          <input
            type="date"
            className="border p-2 rounded"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                { key: "audit_id", label: "ID" },
                { key: "username", label: "Username" },
                { key: "email", label: "Email" },
                { key: "action", label: "Action" },
                { key: "old_values", label: "Old Values" },
                { key: "new_values", label: "New Values" },
                { key: "changed_by", label: "Changed By" },
                { key: "changed_at", label: "Changed At" },
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
                <td className="px-3 py-2 border">{log.username || "-"}</td>
                <td className="px-3 py-2 border">{log.email || "-"}</td>
                <td className="px-3 py-2 border font-medium">{log.action}</td>

                <td className="px-3 py-2 border text-xs whitespace-pre-wrap">
                  {JSON.stringify(log.old_values, null, 2)}
                </td>

                <td className="px-3 py-2 border text-xs whitespace-pre-wrap">
                  {JSON.stringify(log.new_values, null, 2)}
                </td>

                <td className="px-3 py-2 border">{log.changed_by}</td>

                <td className="px-3 py-2 border">
                  {(() => {
                    const dt = getChangedAt(log);
                    return dt ? new Date(dt).toLocaleString() : "-";
                  })()}
                </td>
              </tr>
            ))}

            {processed.slice.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4 text-slate-500">
                  No audit logs found
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
            className="border p-1 rounded"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
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
