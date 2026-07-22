// src/pages/ManualReportCreate.jsx
// ======================================================================
// Manual Accrual / Return Report Creation
// ----------------------------------------------------------------------
// ✔ Supports multiple accounting periods
// ✔ Supports Supplier and Contract typeahead lookup
// ✔ Supports optional linked Accrual report for Returns
// ✔ Missing detail fields generate warnings but do not block submission
// ✔ Uses session-based apiFetch()
// ✔ No hardcoded backend URLs
// ======================================================================

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Plus,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

// ======================================================================
// FIELD DEFINITIONS
// ======================================================================

const REQUIRED_FIELDS = [
  {
    key: "customer_id",
    label: "Customer ID",
    type: "text",
    required: true,
  },
  {
    key: "member_number",
    label: "Member #",
    type: "text",
    required: true,
  },
  {
    key: "member_name",
    label: "Member Name",
    type: "text",
    required: true,
  },
  {
    key: "member_address",
    label: "Member Address",
    type: "text",
    required: true,
  },
  {
    key: "member_city",
    label: "Member City",
    type: "text",
    required: true,
  },
  {
    key: "member_state",
    label: "Member State",
    type: "text",
    required: true,
  },
  {
    key: "member_zip",
    label: "Member Zip",
    type: "text",
    required: true,
  },
  {
    key: "ship_to",
    label: "Ship To",
    type: "text",
    required: true,
  },
  {
    key: "ship_to_address",
    label: "Ship To Address",
    type: "text",
    required: true,
  },
  {
    key: "ship_to_city",
    label: "Ship To City",
    type: "text",
    required: true,
  },
  {
    key: "ship_to_state",
    label: "Ship To State",
    type: "text",
    required: true,
  },
  {
    key: "ship_to_zip",
    label: "Ship To Zip",
    type: "text",
    required: true,
  },
  {
    key: "purchase_dollars",
    label: "Purchase Dollars",
    type: "number",
    step: "0.01",
    required: true,
  },
  {
    key: "caf",
    label: "CAF %",
    type: "number",
    step: "0.0001",
    required: true,
  },
  {
    key: "caf_dollars",
    label: "CAF Dollars",
    type: "number",
    step: "0.01",
    required: true,
  },
];

const OPTIONAL_FIELDS = [
  {
    key: "po",
    label: "PO",
    type: "text",
  },
  {
    key: "invoice",
    label: "Invoice",
    type: "text",
  },
  {
    key: "invoice_date",
    label: "Invoice Date",
    type: "date",
  },
  {
    key: "item",
    label: "Item",
    type: "text",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    type: "text",
  },
  {
    key: "manufacturer_part",
    label: "Manufacturer Part",
    type: "text",
  },
  {
    key: "um",
    label: "UM",
    type: "text",
  },
  {
    key: "desc",
    label: "Description",
    type: "text",
  },
  {
    key: "unspsc",
    label: "UNSPSC",
    type: "text",
  },
  {
    key: "category",
    label: "Category",
    type: "text",
  },
  {
    key: "subcategory",
    label: "SubCategory",
    type: "text",
  },
  {
    key: "retail_price",
    label: "Retail Price",
    type: "number",
    step: "0.01",
  },
  {
    key: "contract_price",
    label: "Contract Price",
    type: "number",
    step: "0.01",
  },
  {
    key: "qty",
    label: "Qty",
    type: "number",
    step: "0.01",
  },
];

const FIELD_DEFS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const NUMBER_FIELDS = new Set([
  "purchase_dollars",
  "caf",
  "caf_dollars",
  "retail_price",
  "contract_price",
  "qty",
]);

// ======================================================================
// HELPERS
// ======================================================================

const emptyRow = () =>
  FIELD_DEFS.reduce((row, field) => {
    row[field.key] = "";
    return row;
  }, {});

const normalizePeriods = (periods) =>
  Array.from(
    new Set(
      periods.map((period) => String(period || "").trim()).filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

const formatPeriod = (period) => {
  if (!period) return "";

  const [year, month] = period.split("-");

  if (!year || !month) {
    return period;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);

  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

// ======================================================================
// COMPONENT
// ======================================================================

export default function ManualReportCreate() {
  const navigate = useNavigate();

  // ====================================================================
  // STATE
  // ====================================================================

  const [form, setForm] = useState({
    report_type: "Accrual",
    periods: [],
    bp_code: "",
    contract_id: "",
    related_report_number: "",
    note: "",
  });

  const [periodInput, setPeriodInput] = useState("");

  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

  // Supplier lookup
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [showSupplierOptions, setShowSupplierOptions] = useState(false);

  // Contract lookup
  const [contractOptions, setContractOptions] = useState([]);
  const [showContractOptions, setShowContractOptions] = useState(false);

  const title = useMemo(
    () =>
      form.report_type === "Return"
        ? "Create Manual Return"
        : "Create Manual Accrual",
    [form.report_type],
  );

  // ====================================================================
  // HEADER HANDLERS
  // ====================================================================

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;

    setError("");

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      if (name === "report_type" && value !== "Return") {
        next.related_report_number = "";
      }

      return next;
    });
  };

  // ====================================================================
  // PERIOD HANDLERS
  // ====================================================================

  const addPeriod = () => {
    const selectedPeriod = String(periodInput || "").trim();

    setError("");

    if (!selectedPeriod) {
      setError("Select a period before clicking Add Period.");
      return;
    }

    setForm((previous) => ({
      ...previous,
      periods: normalizePeriods([...previous.periods, selectedPeriod]),
    }));

    setPeriodInput("");
  };

  const removePeriod = (periodToRemove) => {
    setError("");

    setForm((previous) => ({
      ...previous,
      periods: previous.periods.filter((period) => period !== periodToRemove),
    }));
  };

  // ====================================================================
  // SUPPLIER LOOKUP
  // ====================================================================

  const searchSuppliers = async (value) => {
    setError("");

    setForm((previous) => ({
      ...previous,
      bp_code: value,
    }));

    if (!value || value.trim().length < 1) {
      setSupplierOptions([]);
      setShowSupplierOptions(false);
      return;
    }

    try {
      const data = await apiFetch(
        apiUrl(`/uploads/lookups/suppliers?q=${encodeURIComponent(value)}`),
      );

      setSupplierOptions(Array.isArray(data?.items) ? data.items : []);

      setShowSupplierOptions(true);
    } catch (lookupError) {
      console.error("Supplier lookup failed:", lookupError);

      setSupplierOptions([]);
      setShowSupplierOptions(false);
    }
  };

  // ====================================================================
  // CONTRACT LOOKUP
  // ====================================================================

  const searchContracts = async (value) => {
    setError("");

    setForm((previous) => ({
      ...previous,
      contract_id: value,
    }));

    if (!value || value.trim().length < 1) {
      setContractOptions([]);
      setShowContractOptions(false);
      return;
    }

    try {
      const data = await apiFetch(
        apiUrl(`/uploads/lookups/contracts?q=${encodeURIComponent(value)}`),
      );

      setContractOptions(Array.isArray(data?.items) ? data.items : []);

      setShowContractOptions(true);
    } catch (lookupError) {
      console.error("Contract lookup failed:", lookupError);

      setContractOptions([]);
      setShowContractOptions(false);
    }
  };

  // ====================================================================
  // ROW HANDLERS
  // ====================================================================

  const handleRowChange = (index, field, value) => {
    setError("");

    setRows((previous) => {
      const next = [...previous];

      next[index] = {
        ...next[index],
        [field]: value,
      };

      /*
       * Automatically calculate CAF Dollars when either
       * Purchase Dollars or CAF % changes.
       */
      if (field === "purchase_dollars" || field === "caf") {
        const purchaseDollars = Number(next[index].purchase_dollars || 0);

        const cafRate = Number(next[index].caf || 0);

        if (
          Number.isFinite(purchaseDollars) &&
          Number.isFinite(cafRate) &&
          next[index].purchase_dollars !== "" &&
          next[index].caf !== ""
        ) {
          const calculatedCafDollars =
            Math.round(purchaseDollars * (cafRate / 100) * 100) / 100;

          next[index].caf_dollars = String(calculatedCafDollars);
        }
      }

      return next;
    });
  };

  const addRow = () => {
    setRows((previous) => [...previous, emptyRow()]);
  };

  const removeRow = (index) => {
    setRows((previous) => {
      if (previous.length === 1) {
        return previous;
      }

      return previous.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  // ====================================================================
  // VALIDATION
  // ====================================================================

  const validateForWarnings = () => {
    const warningList = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 1;

      REQUIRED_FIELDS.forEach((field) => {
        const value = row[field.key];

        if (value === "" || value === null || value === undefined) {
          warningList.push(`Row ${rowNumber}: ${field.label} is missing.`);
        }
      });

      NUMBER_FIELDS.forEach((fieldName) => {
        const value = row[fieldName];

        if (
          value !== "" &&
          value !== null &&
          value !== undefined &&
          Number.isNaN(Number(value))
        ) {
          warningList.push(
            `Row ${rowNumber}: ${fieldName} must be a valid number.`,
          );
        }
      });
    });

    return warningList;
  };

  const validateBlockingFields = () => {
    if (!Array.isArray(form.periods) || form.periods.length === 0) {
      return "At least one period is required.";
    }

    if (!rows.length) {
      return "At least one row is required.";
    }

    if (
      form.report_type === "Return" &&
      form.related_report_number &&
      Number.isNaN(Number(form.related_report_number))
    ) {
      return "Linked Accrual Report # must be a valid number.";
    }

    return "";
  };

  // ====================================================================
  // VALUE NORMALIZATION
  // ====================================================================

  const normalizeValue = (key, value) => {
    if (value === "" || value === undefined || value === null) {
      return null;
    }

    if (NUMBER_FIELDS.has(key)) {
      return Number(value);
    }

    return String(value).trim();
  };

  // ====================================================================
  // SUBMIT
  // ====================================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    const blockingError = validateBlockingFields();

    if (blockingError) {
      setError(blockingError);
      return;
    }

    const selectedPeriods = normalizePeriods(form.periods);

    const warningList = validateForWarnings();

    setWarnings(warningList);

    if (warningList.length > 0) {
      const displayedWarnings = warningList.slice(0, 10);

      const remainingWarningCount =
        warningList.length - displayedWarnings.length;

      const proceed = window.confirm(
        `Validation warning:\n\n${displayedWarnings.join("\n")}\n\n${
          remainingWarningCount > 0
            ? `...and ${remainingWarningCount} more issue(s).\n\n`
            : ""
        }This report can still be submitted. Do you want to continue?`,
      );

      if (!proceed) {
        return;
      }
    }

    /*
     * period contains the first selected period for compatibility
     * with older backend or Informatica logic.
     *
     * periods contains the complete multi-period selection.
     *
     * Do not send all periods as one comma-separated value in period,
     * because the backend also combines period with periods[].
     */
    const payload = {
      report_type: form.report_type,

      period: selectedPeriods[0],
      periods: selectedPeriods,

      bp_code: form.bp_code.trim() || null,

      contract_id: form.contract_id.trim() || null,

      related_report_number:
        form.report_type === "Return" && form.related_report_number
          ? Number(form.related_report_number)
          : null,

      note: form.note.trim() || "",

      validation_warnings: warningList,

      validation_error_details: warningList.join("\n"),

      rows: rows.map((row) => {
        const outputRow = {};

        for (const field of FIELD_DEFS) {
          outputRow[field.key] = normalizeValue(field.key, row[field.key]);
        }

        return outputRow;
      }),
    };

    try {
      setSaving(true);

      const result = await apiFetch(apiUrl("/reports/manual-create"), {
        method: "POST",
        body: JSON.stringify(payload),
      });

      /*
       * Continue sending the accounting notification when
       * validation warnings exist.
       */
      if (warningList.length > 0) {
        try {
          await apiFetch(apiUrl("/notify-accounting"), {
            method: "POST",
            body: JSON.stringify({
              fileName: `Manual ${form.report_type} Report #${
                result?.report_number || ""
              }`,

              uploadedBy: "Manual Report Submission",

              errors: warningList,
            }),
          });
        } catch (emailError) {
          console.warn("Manual report validation email failed:", emailError);
        }
      }

      alert(
        result?.message ||
          `${form.report_type} report created and submitted for validation.`,
      );

      navigate("/reports");
    } catch (submitError) {
      console.error("❌ Manual report create failed:", submitError);

      setError(submitError?.message || "Failed to create manual report.");
    } finally {
      setSaving(false);
    }
  };

  // ====================================================================
  // RENDER DETAIL CELL
  // ====================================================================

  const renderCell = (row, index, field) => (
    <td key={field.key} className="border px-2 py-2 min-w-[120px]">
      <input
        type={field.type}
        step={field.step}
        value={row[field.key]}
        onChange={(event) =>
          handleRowChange(index, field.key, event.target.value)
        }
        className="w-full border rounded px-2 py-1"
      />
    </td>
  );

  // ====================================================================
  // UI
  // ====================================================================

  return (
    <div className="p-6 space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold">{title}</h1>

        <div />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ==============================================================
            REPORT HEADER
        ============================================================== */}
        <div className="relative z-50 bg-white shadow rounded-lg p-5 space-y-4 overflow-visible">
          <h2 className="text-lg font-semibold">Report Header</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* REPORT TYPE */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Report Type
              </label>

              <select
                name="report_type"
                value={form.report_type}
                onChange={handleHeaderChange}
                className="w-full border rounded px-3 py-2"
              >
                <option value="Accrual">Accrual</option>

                <option value="Return">Return</option>
              </select>
            </div>

            {/* MULTI-PERIOD SELECTOR */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Accounting Period(s)
                <span className="text-red-500 ml-1">*</span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="month"
                  value={periodInput}
                  onChange={(event) => {
                    setPeriodInput(event.target.value);

                    setError("");
                  }}
                  className="w-full border rounded px-3 py-2"
                />

                <button
                  type="button"
                  onClick={addPeriod}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add Period
                </button>
              </div>

              {form.periods.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.periods.map((period) => (
                    <span
                      key={period}
                      className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                    >
                      {formatPeriod(period)}

                      <button
                        type="button"
                        onClick={() => removePeriod(period)}
                        className="rounded-full p-0.5 hover:bg-indigo-100"
                        aria-label={`Remove ${formatPeriod(period)}`}
                        title="Remove period"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Select a month and click Add Period. You can add multiple
                  accounting periods.
                </p>
              )}
            </div>

            {/* SUPPLIER CODE TYPEAHEAD */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                Supplier Code
              </label>

              <input
                type="text"
                name="bp_code"
                value={form.bp_code}
                onChange={(event) => searchSuppliers(event.target.value)}
                onFocus={() => {
                  if (supplierOptions.length > 0) {
                    setShowSupplierOptions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSupplierOptions(false), 200);
                }}
                placeholder="Type Supplier Code"
                className="w-full border rounded px-3 py-2"
              />

              {showSupplierOptions && supplierOptions.length > 0 && (
                <div className="absolute z-[9999] mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
                  {supplierOptions.map((supplier) => (
                    <button
                      key={supplier.bp_code}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setForm((previous) => ({
                          ...previous,
                          bp_code: supplier.bp_code,
                        }));

                        setShowSupplierOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      {supplier.bp_code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CONTRACT ID TYPEAHEAD */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                Contract ID
              </label>

              <input
                type="text"
                name="contract_id"
                value={form.contract_id}
                onChange={(event) => searchContracts(event.target.value)}
                onFocus={() => {
                  if (contractOptions.length > 0) {
                    setShowContractOptions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowContractOptions(false), 200);
                }}
                placeholder="Type Contract ID or Contract Name"
                className="w-full border rounded px-3 py-2"
              />

              {showContractOptions && contractOptions.length > 0 && (
                <div className="absolute z-[9999] mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
                  {contractOptions.map((contract) => (
                    <button
                      key={contract.contract_id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setForm((previous) => ({
                          ...previous,
                          contract_id: contract.contract_id,
                        }));

                        setShowContractOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      {contract.contract_name
                        ? `${contract.contract_id} - ${contract.contract_name}`
                        : contract.contract_id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LINKED ACCRUAL REPORT */}
            {form.report_type === "Return" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Linked Accrual Report # (Optional)
                </label>

                <input
                  type="number"
                  name="related_report_number"
                  min="1"
                  value={form.related_report_number}
                  onChange={handleHeaderChange}
                  placeholder="Enter original Accrual report #"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            {/* NOTE */}
            <div
              className={form.report_type === "Return" ? "" : "md:col-span-2"}
            >
              <label className="block text-sm font-medium mb-1">Note</label>

              <input
                type="text"
                name="note"
                value={form.note}
                onChange={handleHeaderChange}
                placeholder="Optional note"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* ==============================================================
            MANUAL ROWS
        ============================================================== */}
        <div className="relative z-10 bg-white shadow rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manual Rows</h2>

            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          </div>

          {/* VALIDATION WARNINGS */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {warnings.length} issue(s) found
              </div>

              <ul className="ml-6 list-disc space-y-1">
                {warnings.slice(0, 8).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>

              {warnings.length > 8 && (
                <p className="mt-2 underline">
                  {warnings.length - 8} more issue(s) not shown.
                </p>
              )}

              <p className="mt-3 text-slate-600">
                These details will be sent in the validation email from SSP
                Portal.
              </p>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="h-4 w-4" />
                Error
              </div>

              <p className="mt-2">{error}</p>
            </div>
          )}

          {/* DETAIL TABLE */}
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {FIELD_DEFS.map((field) => (
                    <th
                      key={field.key}
                      className="whitespace-nowrap border px-3 py-2"
                    >
                      {field.label}
                    </th>
                  ))}

                  <th className="border px-3 py-2">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={`manual-row-${index}`}>
                    {FIELD_DEFS.map((field) => renderCell(row, index, field))}

                    <td className="border px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className={
                          rows.length === 1
                            ? "cursor-not-allowed text-gray-400"
                            : "text-red-600 hover:underline"
                        }
                        disabled={rows.length === 1}
                        title={
                          rows.length === 1
                            ? "At least one row is required."
                            : "Remove row"
                        }
                      >
                        <Trash2 className="inline h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUBMIT */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={`rounded px-4 py-2 font-semibold text-white ${
                saving
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {saving ? "Saving..." : `Create ${form.report_type}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
