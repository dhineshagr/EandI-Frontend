import { useCallback, useEffect, useMemo, useState } from "react";
import apiFetch from "../utils/apiFetch";

/*
 * Change the apiFetch import path if your project stores it elsewhere.
 *
 * Examples:
 * import apiFetch from "../../utils/apiFetch";
 * import { apiFetch } from "../services/api";
 */

const EMPTY_NEW_PERIOD = "";

function normalizeApiError(data, fallbackMessage) {
  return (
    data?.message ||
    data?.error ||
    data?.details ||
    fallbackMessage ||
    "An unexpected error occurred."
  );
}

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
  return {
    accounting_period_id:
      record?.accounting_period_id ?? record?.Accounting_Period_ID ?? null,

    period: record?.period ?? record?.Period ?? "",

    is_locked: Boolean(record?.is_locked ?? record?.Is_Locked ?? false),

    status:
      record?.status ||
      (Boolean(record?.is_locked ?? record?.Is_Locked) ? "closed" : "open"),

    locked_by: record?.locked_by ?? record?.Locked_By ?? null,

    locked_at_utc: record?.locked_at_utc ?? record?.Locked_At_UTC ?? null,

    unlocked_by: record?.unlocked_by ?? record?.Unlocked_By ?? null,

    unlocked_at_utc: record?.unlocked_at_utc ?? record?.Unlocked_At_UTC ?? null,

    created_at_utc: record?.created_at_utc ?? record?.Created_At_UTC ?? null,

    updated_at_utc: record?.updated_at_utc ?? record?.Updated_At_UTC ?? null,
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

  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  const loadAccountingPeriods = useCallback(
    async ({ refresh = false } = {}) => {
      clearMessages();

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await apiFetch("/reports/accounting-periods", {
          method: "GET",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            normalizeApiError(data, "Unable to load accounting periods."),
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
    [],
  );

  useEffect(() => {
    loadAccountingPeriods();
  }, [loadAccountingPeriods]);

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
      (item) => String(item.period).trim() === period,
    );

    if (alreadyExists) {
      setErrorMessage(`Accounting period ${period} already exists.`);
      return;
    }

    setCreating(true);

    try {
      const response = await apiFetch("/reports/accounting-periods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          normalizeApiError(data, "Unable to create accounting period."),
        );
      }

      setNewPeriod(EMPTY_NEW_PERIOD);

      setSuccessMessage(
        data?.message ||
          `Accounting period ${period} was created successfully.`,
      );

      await loadAccountingPeriods();
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

    setProcessingPeriod(period);
    setProcessingAction("lock");

    try {
      const encodedPeriod = encodeURIComponent(period);

      const response = await apiFetch(
        `/reports/accounting-periods/${encodedPeriod}/lock`,
        {
          method: "PUT",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(normalizeApiError(data, `Unable to lock ${period}.`));
      }

      setSuccessMessage(
        data?.message || `Accounting period ${period} was locked successfully.`,
      );

      setPeriods((currentPeriods) =>
        currentPeriods.map((item) =>
          item.period === period
            ? normalizePeriodRecord(
                data?.period || {
                  ...item,
                  is_locked: true,
                  status: "closed",
                },
              )
            : item,
        ),
      );
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

    setProcessingPeriod(period);
    setProcessingAction("unlock");

    try {
      const encodedPeriod = encodeURIComponent(period);

      const response = await apiFetch(
        `/reports/accounting-periods/${encodedPeriod}/unlock`,
        {
          method: "PUT",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(normalizeApiError(data, `Unable to unlock ${period}.`));
      }

      setSuccessMessage(
        data?.message ||
          `Accounting period ${period} was unlocked successfully.`,
      );

      setPeriods((currentPeriods) =>
        currentPeriods.map((item) =>
          item.period === period
            ? normalizePeriodRecord(
                data?.period || {
                  ...item,
                  is_locked: false,
                  status: "open",
                },
              )
            : item,
        ),
      );
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
              submission.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadAccountingPeriods({ refresh: true })}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Messages */}
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

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Important:</strong> When a period is locked, Report,
          Adjustment, and Return creation will be blocked for that period.
        </div>
      </div>
    </div>
  );
}
