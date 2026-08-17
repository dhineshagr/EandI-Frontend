import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

const EMPTY_NEW_PERIOD = "";

function formatPeriod(period) {
  const value = String(period || "").trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value || "—";
  }

  const [year, month] = value.split("-");

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatUtcDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getCurrentMonth() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function normalizePeriodRecord(record) {
  const isLocked = Boolean(record?.is_locked ?? record?.Is_Locked ?? false);

  return {
    accounting_period_id:
      record?.accounting_period_id ?? record?.Accounting_Period_ID ?? null,

    period: record?.period ?? record?.Period ?? "",

    is_locked: isLocked,

    status: record?.status || (isLocked ? "closed" : "open"),

    locked_by: record?.locked_by ?? record?.Locked_By ?? null,

    locked_at_utc: record?.locked_at_utc ?? record?.Locked_At_UTC ?? null,

    unlocked_by: record?.unlocked_by ?? record?.Unlocked_By ?? null,

    unlocked_at_utc: record?.unlocked_at_utc ?? record?.Unlocked_At_UTC ?? null,

    created_at_utc: record?.created_at_utc ?? record?.Created_At_UTC ?? null,

    updated_at_utc: record?.updated_at_utc ?? record?.Updated_At_UTC ?? null,
  };
}

function normalizeHistoryRecord(record) {
  return {
    audit_id:
      record?.audit_id ??
      record?.Audit_ID ??
      record?.accounting_period_audit_id ??
      null,

    period: record?.period ?? record?.Period ?? "",

    action: String(record?.action ?? record?.Action ?? "")
      .trim()
      .toUpperCase(),

    reason:
      record?.reason ??
      record?.Reason ??
      record?.change_reason ??
      record?.Change_Reason ??
      "",

    changed_by:
      record?.changed_by ??
      record?.Changed_By ??
      record?.user_email ??
      record?.User_Email ??
      "—",

    changed_at_utc:
      record?.changed_at_utc ??
      record?.Changed_At_UTC ??
      record?.created_at_utc ??
      record?.Created_At_UTC ??
      null,
  };
}

export default function ManageAccountingPeriods() {
  const [periods, setPeriods] = useState([]);

  const [newPeriod, setNewPeriod] = useState(EMPTY_NEW_PERIOD);

  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [processingPeriod, setProcessingPeriod] = useState(null);

  const [processingAction, setProcessingAction] = useState(null);

  const [successMessage, setSuccessMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  // ====================================================================
  // ACCOUNTING PERIOD AUDIT HISTORY
  // ====================================================================

  const [history, setHistory] = useState([]);

  const [historyLoading, setHistoryLoading] = useState(true);

  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  const [historyError, setHistoryError] = useState("");

  const [historySearch, setHistorySearch] = useState("");

  const [historyActionFilter, setHistoryActionFilter] = useState("");

  const [historyPage, setHistoryPage] = useState(1);

  const [historyPageSize, setHistoryPageSize] = useState(25);

  const clearMessages = useCallback(() => {
    setSuccessMessage("");
    setErrorMessage("");
  }, []);

  const loadAccountingPeriods = useCallback(
    async ({ refresh = false, preserveMessage = false } = {}) => {
      if (!preserveMessage) {
        clearMessages();
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await apiFetch(apiUrl("/reports/accounting-periods"));

        /*
         * apiFetch returns null for HTTP 401.
         */
        if (!data) {
          throw new Error(
            "Your session may have expired. Please sign in again.",
          );
        }

        const records = Array.isArray(data?.periods)
          ? data.periods
          : Array.isArray(data)
            ? data
            : [];

        setPeriods(records.map(normalizePeriodRecord));
      } catch (error) {
        console.error("Load accounting periods failed:", error);

        setErrorMessage(error?.message || "Unable to load accounting periods.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clearMessages],
  );

  const loadAccountingPeriodHistory = useCallback(
    async ({ refresh = false } = {}) => {
      setHistoryError("");

      if (refresh) {
        setHistoryRefreshing(true);
      } else {
        setHistoryLoading(true);
      }

      try {
        /*
         * New endpoint required by the client enhancement.
         *
         * The backend route will return lock/unlock events for the prior
         * two years. This frontend intentionally handles the endpoint
         * independently from the current-period API.
         */
        const data = await apiFetch(
          apiUrl("/reports/accounting-periods/history?years=2"),
        );

        if (!data) {
          throw new Error(
            "Your session may have expired. Please sign in again.",
          );
        }

        const records = Array.isArray(data?.history)
          ? data.history
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        setHistory(records.map(normalizeHistoryRecord));
      } catch (error) {
        console.error("Load accounting period history failed:", error);

        setHistory([]);

        setHistoryError(
          error?.message ||
            "Unable to load accounting period lock/unlock history.",
        );
      } finally {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadAccountingPeriods();
    loadAccountingPeriodHistory();
  }, [loadAccountingPeriods, loadAccountingPeriodHistory]);

  const periodCounts = useMemo(() => {
    const total = periods.length;

    const locked = periods.filter((item) => item.is_locked).length;

    const open = total - locked;

    return {
      total,
      open,
      locked,
    };
  }, [periods]);

  const filteredHistory = useMemo(() => {
    let list = [...history];

    const queryValue = String(historySearch || "")
      .trim()
      .toLowerCase();

    if (queryValue) {
      list = list.filter((item) =>
        [
          item.period,
          formatPeriod(item.period),
          item.action,
          item.reason,
          item.changed_by,
          formatUtcDate(item.changed_at_utc),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(queryValue),
      );
    }

    if (historyActionFilter) {
      list = list.filter((item) => item.action === historyActionFilter);
    }

    list.sort((left, right) => {
      const leftTime = Date.parse(left.changed_at_utc || "") || 0;
      const rightTime = Date.parse(right.changed_at_utc || "") || 0;

      return rightTime - leftTime;
    });

    return list;
  }, [history, historySearch, historyActionFilter]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / historyPageSize),
  );

  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;

    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  const handleCreatePeriod = async (event) => {
    event.preventDefault();

    clearMessages();

    const period = String(newPeriod || "").trim();

    if (!period) {
      setErrorMessage("Please select an accounting period.");

      return;
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      setErrorMessage("Accounting period must use YYYY-MM format.");

      return;
    }

    const alreadyExists = periods.some(
      (item) => String(item.period || "").trim() === period,
    );

    if (alreadyExists) {
      setErrorMessage(`Accounting period ${period} already exists.`);

      return;
    }

    setCreating(true);

    try {
      const data = await apiFetch(apiUrl("/reports/accounting-periods"), {
        method: "POST",

        body: JSON.stringify({
          period,
        }),
      });

      if (!data) {
        throw new Error("Your session may have expired. Please sign in again.");
      }

      setNewPeriod(EMPTY_NEW_PERIOD);

      setSuccessMessage(
        data?.message ||
          `Accounting period ${period} was created successfully.`,
      );

      await loadAccountingPeriods({
        preserveMessage: true,
      });
    } catch (error) {
      console.error("Create accounting period failed:", error);

      setErrorMessage(error?.message || "Unable to create accounting period.");
    } finally {
      setCreating(false);
    }
  };

  const handleLockPeriod = async (periodRecord) => {
    clearMessages();

    const period = String(periodRecord?.period || "").trim();

    if (!period) {
      setErrorMessage("Invalid accounting period.");

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to lock ${formatPeriod(period)}?\n\n` +
        "Users will not be able to create reports for this accounting period.",
    );

    if (!confirmed) {
      return;
    }

    const reasonInput = window.prompt(
      `Please enter the reason for locking ${formatPeriod(period)}:`,
      "",
    );

    if (reasonInput === null) {
      return;
    }

    const reason = String(reasonInput || "").trim();

    if (!reason) {
      setErrorMessage("A reason is required to lock an accounting period.");
      return;
    }

    setProcessingPeriod(period);
    setProcessingAction("lock");

    try {
      const encodedPeriod = encodeURIComponent(period);

      const data = await apiFetch(
        apiUrl(`/reports/accounting-periods/${encodedPeriod}/lock`),
        {
          method: "PUT",
          body: JSON.stringify({
            reason,
          }),
        },
      );

      if (!data) {
        throw new Error("Your session may have expired. Please sign in again.");
      }

      setSuccessMessage(
        data?.message || `Accounting period ${period} was locked successfully.`,
      );

      setPeriods((currentPeriods) =>
        currentPeriods.map((item) => {
          if (item.period !== period) {
            return item;
          }

          return normalizePeriodRecord(
            data?.period || {
              ...item,

              is_locked: true,

              status: "closed",
            },
          );
        }),
      );

      await loadAccountingPeriodHistory({
        refresh: true,
      });
    } catch (error) {
      console.error("Lock accounting period failed:", error);

      setErrorMessage(
        error?.message || `Unable to lock accounting period ${period}.`,
      );
    } finally {
      setProcessingPeriod(null);
      setProcessingAction(null);
    }
  };

  const handleUnlockPeriod = async (periodRecord) => {
    clearMessages();

    const period = String(periodRecord?.period || "").trim();

    if (!period) {
      setErrorMessage("Invalid accounting period.");

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to unlock ${formatPeriod(period)}?\n\n` +
        "Users will be able to create reports for this accounting period.",
    );

    if (!confirmed) {
      return;
    }

    const reasonInput = window.prompt(
      `Please enter the reason for unlocking ${formatPeriod(period)}:`,
      "",
    );

    if (reasonInput === null) {
      return;
    }

    const reason = String(reasonInput || "").trim();

    if (!reason) {
      setErrorMessage("A reason is required to unlock an accounting period.");
      return;
    }

    setProcessingPeriod(period);
    setProcessingAction("unlock");

    try {
      const encodedPeriod = encodeURIComponent(period);

      const data = await apiFetch(
        apiUrl(`/reports/accounting-periods/${encodedPeriod}/unlock`),
        {
          method: "PUT",
          body: JSON.stringify({
            reason,
          }),
        },
      );

      if (!data) {
        throw new Error("Your session may have expired. Please sign in again.");
      }

      setSuccessMessage(
        data?.message ||
          `Accounting period ${period} was unlocked successfully.`,
      );

      setPeriods((currentPeriods) =>
        currentPeriods.map((item) => {
          if (item.period !== period) {
            return item;
          }

          return normalizePeriodRecord(
            data?.period || {
              ...item,

              is_locked: false,

              status: "open",
            },
          );
        }),
      );

      await loadAccountingPeriodHistory({
        refresh: true,
      });
    } catch (error) {
      console.error("Unlock accounting period failed:", error);

      setErrorMessage(
        error?.message || `Unable to unlock accounting period ${period}.`,
      );
    } finally {
      setProcessingPeriod(null);
      setProcessingAction(null);
    }
  };

  const isProcessing = (period, action) =>
    processingPeriod === period && processingAction === action;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Manage Accounting Periods
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Create, lock, and unlock accounting periods used during report
              submission. Lock and unlock activity is retained in the audit
              history.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadAccountingPeriods({
                refresh: true,
              })
            }
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Success message */}
        {successMessage && (
          <div
            className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <span>{successMessage}</span>

              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="font-semibold text-green-700 hover:text-green-900"
                aria-label="Close success message"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div
            className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <span>{errorMessage}</span>

              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="font-semibold text-red-700 hover:text-red-900"
                aria-label="Close error message"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Periods</p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {periodCounts.total}
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-green-700">Open Periods</p>

            <p className="mt-2 text-3xl font-bold text-green-700">
              {periodCounts.open}
            </p>
          </div>

          <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-700">Locked Periods</p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              {periodCounts.locked}
            </p>
          </div>
        </div>

        {/* Add accounting period */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Add Accounting Period
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            New accounting periods are created with an Open status.
          </p>

          <form
            onSubmit={handleCreatePeriod}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="w-full sm:max-w-xs">
              <label
                htmlFor="accounting-period"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Accounting Period
              </label>

              <input
                id="accounting-period"
                type="month"
                value={newPeriod}
                max="9999-12"
                onChange={(event) => {
                  setNewPeriod(event.target.value);

                  clearMessages();
                }}
                disabled={creating}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={creating || !newPeriod}
              className="inline-flex min-w-32 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {creating ? "Adding..." : "Add Period"}
            </button>

            <button
              type="button"
              onClick={() => setNewPeriod(getCurrentMonth())}
              disabled={creating}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Current Month
            </button>
          </form>
        </div>

        {/* Period table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Accounting Periods
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center">
              <div className="text-sm font-medium text-slate-600">
                Loading accounting periods...
              </div>
            </div>
          ) : periods.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-700">
                No accounting periods are configured.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Use the form above to add the first accounting period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Period
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Status
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Locked By
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Locked Date
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Last Unlocked By
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Last Updated
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {periods.map((item) => {
                    const rowIsProcessing = processingPeriod === item.period;

                    return (
                      <tr
                        key={item.accounting_period_id || item.period}
                        className="hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {formatPeriod(item.period)}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {item.period}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          {item.is_locked ? (
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                              Locked
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                              Open
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.locked_by || "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatUtcDate(item.locked_at_utc)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.unlocked_by || "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatUtcDate(item.updated_at_utc)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          {item.is_locked ? (
                            <button
                              type="button"
                              onClick={() => handleUnlockPeriod(item)}
                              disabled={rowIsProcessing}
                              className="inline-flex min-w-24 items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                            >
                              {isProcessing(item.period, "unlock")
                                ? "Unlocking..."
                                : "Unlock"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLockPeriod(item)}
                              disabled={rowIsProcessing}
                              className="inline-flex min-w-24 items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                            >
                              {isProcessing(item.period, "lock")
                                ? "Locking..."
                                : "Lock"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accounting period audit history */}
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Accounting Period Audit History
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Shows each lock and unlock event from the prior two years.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadAccountingPeriodHistory({
                    refresh: true,
                  })
                }
                disabled={historyRefreshing || historyLoading}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {historyRefreshing ? "Refreshing..." : "Refresh History"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search period, reason, or user"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:col-span-2"
              />

              <select
                value={historyActionFilter}
                onChange={(event) => {
                  setHistoryActionFilter(event.target.value);
                  setHistoryPage(1);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">All Actions</option>
                <option value="LOCK">Lock</option>
                <option value="UNLOCK">Unlock</option>
              </select>
            </div>
          </div>

          {historyError && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
              {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="px-6 py-16 text-center">
              <div className="text-sm font-medium text-slate-600">
                Loading accounting period audit history...
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-700">
                No lock/unlock audit history found.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                New lock and unlock actions will appear here after the backend
                audit-history enhancement is deployed.
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Period
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Action
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Reason
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Changed By
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Changed Date
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pagedHistory.map((item, index) => (
                      <tr
                        key={
                          item.audit_id ||
                          `${item.period}-${item.action}-${item.changed_at_utc}-${index}`
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {formatPeriod(item.period)}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {item.period || "—"}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          {item.action === "LOCK" ? (
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                              Lock
                            </span>
                          ) : item.action === "UNLOCK" ? (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                              Unlock
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {item.action || "—"}
                            </span>
                          )}
                        </td>

                        <td className="max-w-md whitespace-normal px-5 py-4 text-sm text-slate-700">
                          {item.reason || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {item.changed_by || "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatUtcDate(item.changed_at_utc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Rows per page:</span>

                  <select
                    value={historyPageSize}
                    onChange={(event) => {
                      setHistoryPageSize(Number(event.target.value));
                      setHistoryPage(1);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>

                  <span>
                    {filteredHistory.length === 0
                      ? "0–0 of 0"
                      : `${(historyPage - 1) * historyPageSize + 1}–${Math.min(
                          historyPage * historyPageSize,
                          filteredHistory.length,
                        )} of ${filteredHistory.length}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHistoryPage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    disabled={historyPage <= 1}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>

                  <span className="text-sm text-slate-600">
                    Page {historyPage} / {historyTotalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setHistoryPage((currentPage) =>
                        Math.min(historyTotalPages, currentPage + 1),
                      )
                    }
                    disabled={historyPage >= historyTotalPages}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Important:</strong> When an accounting period is locked, it
          cannot be selected as a Posting Period for new report submissions.
        </div>
      </div>
    </div>
  );
}
