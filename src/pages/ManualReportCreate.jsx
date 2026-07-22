// src/pages/ManualReportCreate.jsx
// ======================================================================
// Manual Report / Adjustment / Return Creation
// ----------------------------------------------------------------------
// Report
//   - User selects periods, supplier, and contract.
//   - User manually enters detail rows.
//   - Linked report is not required.
//
// Adjustment
//   - User selects periods, supplier, and contract.
//   - User manually enters detail rows.
//   - Linked original report is required.
//
// Return
//   - Linked approved Accrual report is required.
//   - User does not enter detail rows.
//   - Periods, supplier, and contract are inherited by the backend.
//   - Backend copies approved rows from Cur_Invoice_Detail.
//   - Backend reverses Purchase_Dollars_Calc and CAF_Dollars.
//
// Common functionality
//   - Uses session-based apiFetch().
//   - No hardcoded backend URLs.
//   - Missing detail fields create warnings but do not block submission.
// ======================================================================

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Info,
  Plus,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

// ======================================================================
// REPORT TYPES
// ======================================================================

const REPORT_TYPES = [
  {
    value: "Report",
    label: "Report",
  },
  {
    value: "Adjustment",
    label: "Adjustment",
  },
  {
    value: "Return",
    label: "Return",
  },
];

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
      (Array.isArray(periods) ? periods : [])
        .map((period) => String(period || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

const formatPeriod = (period) => {
  if (!period) {
    return "";
  }

  const [year, month] = String(period).split("-");

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

const isPositiveInteger = (value) => {
  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0;
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
    report_type: "Report",
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

  // ====================================================================
  // DERIVED VALUES
  // ====================================================================

  const isReport = form.report_type === "Report";

  const isAdjustment = form.report_type === "Adjustment";

  const isReturn = form.report_type === "Return";

  const requiresManualRows = isReport || isAdjustment;

  const requiresLinkedReport = isAdjustment || isReturn;

  const title = useMemo(() => {
    if (form.report_type === "Adjustment") {
      return "Create Manual Adjustment";
    }

    if (form.report_type === "Return") {
      return "Create Manual Return";
    }

    return "Create Manual Report";
  }, [form.report_type]);

  const linkedReportLabel = isReturn
    ? "Linked Accrual Report #"
    : "Linked Original Report #";

  const linkedReportPlaceholder = isReturn
    ? "Enter approved Accrual report #"
    : "Enter original report #";

  // ====================================================================
  // HEADER HANDLERS
  // ====================================================================

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;

    setError("");
    setWarnings([]);

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      if (name === "report_type") {
        /*
         * Report does not use a linked report.
         */
        if (value === "Report") {
          next.related_report_number = "";
        }

        /*
         * Return inherits these values from the linked Accrual.
         * Clear previously entered values so they are not displayed
         * as though they will be submitted.
         */
        if (value === "Return") {
          next.periods = [];
          next.bp_code = "";
          next.contract_id = "";
        }
      }

      return next;
    });

    /*
     * Return does not use manually entered rows.
     * Keep a clean initial row ready if the user switches back.
     */
    if (name === "report_type" && value === "Return") {
      setPeriodInput("");
    }

    if (
      name === "report_type" &&
      (value === "Report" || value === "Adjustment") &&
      rows.length === 0
    ) {
      setRows([emptyRow()]);
    }
  };

  // ====================================================================
  // PERIOD HANDLERS
  // ====================================================================

  const addPeriod = () => {
    const selectedPeriod = String(periodInput || "").trim();

    setError("");
    setWarnings([]);

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
    setWarnings([]);

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
    setWarnings([]);

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
    setWarnings([]);

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
    setWarnings([]);

    setRows((previous) => {
      const next = [...previous];

      next[index] = {
        ...next[index],
        [field]: value,
      };

      /*
       * Automatically calculate CAF Dollars when Purchase Dollars
       * or CAF percentage changes.
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
        } else {
          next[index].caf_dollars = "";
        }
      }

      return next;
    });
  };

  const addRow = () => {
    setError("");
    setWarnings([]);

    setRows((previous) => [...previous, emptyRow()]);
  };

  const removeRow = (index) => {
    setError("");
    setWarnings([]);

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
    /*
     * Return rows are created automatically by the backend.
     */
    if (isReturn) {
      return [];
    }

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
          const fieldDefinition = FIELD_DEFS.find(
            (field) => field.key === fieldName,
          );

          warningList.push(
            `Row ${rowNumber}: ${
              fieldDefinition?.label || fieldName
            } must be a valid number.`,
          );
        }
      });
    });

    return warningList;
  };

  const validateBlockingFields = () => {
    if (!form.report_type) {
      return "Report Type is required.";
    }

    /*
     * Report and Adjustment require user-selected periods.
     * Return periods are inherited by the backend.
     */
    if (
      !isReturn &&
      (!Array.isArray(form.periods) || form.periods.length === 0)
    ) {
      return "At least one accounting period is required.";
    }

    /*
     * Report and Adjustment require manual rows.
     */
    if (requiresManualRows && (!Array.isArray(rows) || rows.length === 0)) {
      return "At least one manual detail row is required.";
    }

    /*
     * Adjustment and Return require a linked report.
     */
    if (
      requiresLinkedReport &&
      !String(form.related_report_number || "").trim()
    ) {
      return isReturn
        ? "Linked Accrual Report # is required."
        : "Linked Original Report # is required.";
    }

    if (
      requiresLinkedReport &&
      !isPositiveInteger(form.related_report_number)
    ) {
      return isReturn
        ? "Linked Accrual Report # must be a positive integer."
        : "Linked Original Report # must be a positive integer.";
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
      const numericValue = Number(value);

      return Number.isFinite(numericValue) ? numericValue : null;
    }

    return String(value).trim();
  };

  const buildManualRows = () =>
    rows.map((row) => {
      const outputRow = {};

      for (const field of FIELD_DEFS) {
        outputRow[field.key] = normalizeValue(field.key, row[field.key]);
      }

      return outputRow;
    });

  // ====================================================================
  // SUBMIT
  // ====================================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setWarnings([]);

    const blockingError = validateBlockingFields();

    if (blockingError) {
      setError(blockingError);

      return;
    }

    const selectedPeriods = isReturn ? [] : normalizePeriods(form.periods);

    const warningList = validateForWarnings();

    setWarnings(warningList);

    /*
     * Report and Adjustment warnings do not block submission.
     * Return has no UI-entered detail rows, so no row warnings apply.
     */
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

    const linkedReportNumber = requiresLinkedReport
      ? Number(form.related_report_number)
      : null;

    /*
     * Return sends no periods, supplier, contract, or manual rows.
     * The backend inherits and creates these values from the linked
     * approved Accrual report.
     */
    const payload = {
      report_type: form.report_type,

      period: selectedPeriods.length > 0 ? selectedPeriods[0] : null,

      periods: selectedPeriods,

      bp_code: isReturn ? null : form.bp_code.trim() || null,

      contract_id: isReturn ? null : form.contract_id.trim() || null,

      related_report_number: linkedReportNumber,

      note: form.note.trim() || "",

      validation_warnings: isReturn ? [] : warningList,

      validation_error_details: isReturn ? "" : warningList.join("\n"),

      rows: isReturn ? [] : buildManualRows(),
    };

    try {
      setSaving(true);

      const result = await apiFetch(apiUrl("/reports/manual-create"), {
        method: "POST",
        body: JSON.stringify(payload),
      });

      /*
       * Send accounting notification only for manually entered
       * Report or Adjustment rows that contain validation warnings.
       */
      if (!isReturn && warningList.length > 0) {
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

      window.alert(
        result?.message ||
          `${form.report_type} report was created successfully.`,
      );

      navigate("/reports");
    } catch (submitError) {
      console.error("❌ Manual report create failed:", submitError);

      setError(submitError?.message || "Failed to create the manual report.");
    } finally {
      setSaving(false);
    }
  };

  // ====================================================================
  // RENDER DETAIL CELL
  // ====================================================================

  const renderCell = (row, index, field) => (
    <td key={field.key} className="min-w-[120px] border px-2 py-2">
      <input
        type={field.type}
        step={field.step}
        value={row[field.key]}
        onChange={(event) =>
          handleRowChange(index, field.key, event.target.value)
        }
        className="w-full rounded border px-2 py-1"
      />
    </td>
  );

  // ====================================================================
  // UI
  // ====================================================================

  return (
    <div className="space-y-6 p-6">
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
        <div className="relative z-50 space-y-4 overflow-visible rounded-lg bg-white p-5 shadow">
          <h2 className="text-lg font-semibold">Report Header</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* REPORT TYPE */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Report Type
                <span className="ml-1 text-red-500">*</span>
              </label>

              <select
                name="report_type"
                value={form.report_type}
                onChange={handleHeaderChange}
                className="w-full rounded border px-3 py-2"
                disabled={saving}
              >
                {REPORT_TYPES.map((reportType) => (
                  <option key={reportType.value} value={reportType.value}>
                    {reportType.label}
                  </option>
                ))}
              </select>
            </div>

            {/* LINKED REPORT */}
            {requiresLinkedReport && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {linkedReportLabel}
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  type="number"
                  name="related_report_number"
                  min="1"
                  step="1"
                  value={form.related_report_number}
                  onChange={handleHeaderChange}
                  placeholder={linkedReportPlaceholder}
                  className="w-full rounded border px-3 py-2"
                  disabled={saving}
                />

                <p className="mt-1 text-xs text-slate-500">
                  {isReturn
                    ? "The selected report must be an approved Accrual report."
                    : "Enter the original report associated with this adjustment."}
                </p>
              </div>
            )}

            {/* NOTE */}
            <div className={requiresLinkedReport ? "" : "md:col-span-2"}>
              <label className="mb-1 block text-sm font-medium">Note</label>

              <input
                type="text"
                name="note"
                value={form.note}
                onChange={handleHeaderChange}
                placeholder="Optional note"
                className="w-full rounded border px-3 py-2"
                disabled={saving}
              />
            </div>

            {/* RETURN INFORMATION */}
            {isReturn && (
              <div className="md:col-span-3">
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" />

                  <div>
                    <p className="font-semibold">Return information</p>

                    <p className="mt-1">
                      Supplier, Contract, and Accounting Periods will be
                      inherited from the linked approved Accrual report.
                      Approved processed rows will be copied automatically.
                      Purchase Dollars and CAF Dollars will be reversed by the
                      backend.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PERIOD SELECTOR */}
            {!isReturn && (
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium">
                  Accounting Period(s)
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="month"
                    value={periodInput}
                    onChange={(event) => {
                      setPeriodInput(event.target.value);

                      setError("");
                      setWarnings([]);
                    }}
                    className="w-full rounded border px-3 py-2"
                    disabled={saving}
                  />

                  <button
                    type="button"
                    onClick={addPeriod}
                    disabled={saving}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Add Period
                  </button>
                </div>

                {form.periods.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.periods.map((selectedPeriod) => (
                      <span
                        key={selectedPeriod}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                      >
                        {formatPeriod(selectedPeriod)}

                        <button
                          type="button"
                          onClick={() => removePeriod(selectedPeriod)}
                          disabled={saving}
                          className="rounded-full p-0.5 hover:bg-indigo-100 disabled:cursor-not-allowed"
                          aria-label={`Remove ${formatPeriod(selectedPeriod)}`}
                          title="Remove period"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Select a month and click Add Period. Multiple accounting
                    periods can be selected.
                  </p>
                )}
              </div>
            )}

            {/* SUPPLIER CODE */}
            {!isReturn && (
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">
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
                  className="w-full rounded border px-3 py-2"
                  disabled={saving}
                  autoComplete="off"
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
            )}

            {/* CONTRACT ID */}
            {!isReturn && (
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">
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
                  className="w-full rounded border px-3 py-2"
                  disabled={saving}
                  autoComplete="off"
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
            )}
          </div>
        </div>

        {/* ==============================================================
            ERROR
        ============================================================== */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold">
              <XCircle className="h-4 w-4" />
              Error
            </div>

            <p className="mt-2">{error}</p>
          </div>
        )}

        {/* ==============================================================
            MANUAL ROWS — REPORT AND ADJUSTMENT ONLY
        ============================================================== */}
        {requiresManualRows && (
          <div className="relative z-10 space-y-4 rounded-lg bg-white p-5 shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Manual Rows</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Missing fields generate warnings but do not block submission.
                </p>
              </div>

              <button
                type="button"
                onClick={addRow}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>
            </div>

            {/* VALIDATION WARNINGS */}
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {warnings.length} issue(s) found
                </div>

                <ul className="ml-6 list-disc space-y-1">
                  {warnings.slice(0, 8).map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
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
                            rows.length === 1 || saving
                              ? "cursor-not-allowed text-gray-400"
                              : "text-red-600 hover:underline"
                          }
                          disabled={rows.length === 1 || saving}
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
          </div>
        )}

        {/* ==============================================================
            RETURN SUMMARY
        ============================================================== */}
        {isReturn && (
          <div className="rounded-lg bg-white p-5 shadow">
            <h2 className="text-lg font-semibold">Return Processing</h2>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                No manual rows are required. When submitted, the backend will:
              </p>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Validate that the linked report is an approved Accrual.</li>

                <li>Inherit Supplier, Contract, and Accounting Periods.</li>

                <li>Copy approved processed rows from Cur_Invoice_Detail.</li>

                <li>Reverse Purchase Dollars and CAF Dollars.</li>

                <li>
                  Stage the Return for the scheduled Informatica workflow.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ==============================================================
            SUBMIT
        ============================================================== */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="rounded border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

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
      </form>
    </div>
  );
}
