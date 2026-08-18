// src/pages/ManualReportCreate.jsx
// ======================================================================
// Manual Report / Adjustment / Return Creation
// ----------------------------------------------------------------------
// Report
//   - User selects Report Period(s) and Posting Period(s), supplier, and contract.
//   - Report Period(s) are used for reporting/searching and are not locked.
//   - Posting Period(s) are accounting periods and must be open.
//   - User manually enters detail rows.
//   - Linked report is not required.
//
// Adjustment
//   - User selects Report Period(s) and Posting Period(s), supplier, and contract.
//   - Report Period(s) are used for reporting/searching and are not locked.
//   - Posting Period(s) are accounting periods and must be open.
//   - User manually enters detail rows.
//   - Linked original report is required.
//
// Return
//   - Linked approved Report (Sales) or Accrual is required.
//   - User chooses Manual Entry or Automated Reversal.
//   - Periods, supplier, and contract are inherited by the backend.
//   - Manual Entry: user enters Return detail rows manually.
//   - Automated Reversal: backend copies approved rows from Cur_Invoice_Detail.
//   - Automated Reversal: backend reverses Purchase_Dollars_Calc and CAF_Dollars.
//
// Period model:
//   - Report Period(s) are selected independently and are not lock-validated.
//   - Posting Period(s) are checked against /reports/accounting-periods.
//   - Closed Posting Period(s) cannot be added for Report or Adjustment.
//   - Previously selected Posting Period(s) are revalidated before submission.
//   - For a Posting Period range, the ending month is the NetSuite posting period.
//   - Return continues to inherit periods from the linked approved Report/Accrual.
//
//
// Common functionality:
//   - Uses session-based apiFetch().
//   - No hardcoded backend URLs.
//   - Missing detail fields create warnings but do not block submission.
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Info,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
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
// ACCOUNTING PERIOD STATUS
// ======================================================================

const PERIOD_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
};

const normalizePeriodStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "closed" ||
    normalized === "frozen" ||
    normalized === "locked"
  ) {
    return PERIOD_STATUS.CLOSED;
  }

  return PERIOD_STATUS.OPEN;
};

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

/*
 * DQ validation groups.
 *
 * Keep the existing manual-entry columns unchanged, but apply the
 * client's conditional address validation rules when warnings are built.
 */
const CORE_REQUIRED_FIELD_KEYS = new Set([
  "customer_id",
  "member_number",
  "member_name",
  "purchase_dollars",
  "caf",
  "caf_dollars",
]);

const MEMBER_ADDRESS_FIELD_KEYS = [
  "member_address",
  "member_city",
  "member_state",
  "member_zip",
];

const SHIP_TO_ADDRESS_FIELD_KEYS = [
  "ship_to",
  "ship_to_address",
  "ship_to_city",
  "ship_to_state",
  "ship_to_zip",
];

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

const formatPeriodRangeLabel = (periods, singleLabel = "Period") => {
  const normalized = normalizePeriods(periods);

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return `${singleLabel}: ${normalized[0]}`;
  }

  return `Start Period: ${normalized[0]}  End Period: ${
    normalized[normalized.length - 1]
  }`;
};

const normalizePeriodRecords = (data) => {
  const rawPeriods = Array.isArray(data?.periods)
    ? data.periods
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];

  return rawPeriods
    .map((item) => {
      if (typeof item === "string") {
        return {
          period: String(item).trim(),
          status: PERIOD_STATUS.OPEN,
          reason: "",
          closed_by: null,
          closed_at_utc: null,
        };
      }

      const period = String(
        item?.period ?? item?.accounting_period ?? item?.month ?? "",
      ).trim();

      if (!period) {
        return null;
      }

      return {
        period,
        status: normalizePeriodStatus(
          item?.status ?? item?.period_status ?? item?.is_closed,
        ),
        reason: String(
          item?.reason ?? item?.close_reason ?? item?.note ?? "",
        ).trim(),
        closed_by: item?.closed_by ?? null,
        closed_at_utc: item?.closed_at_utc ?? null,
      };
    })
    .filter(Boolean);
};

// ======================================================================
// COMPONENT
// ======================================================================

export default function ManualReportCreate() {
  const navigate = useNavigate();

  // ====================================================================
  // FORM STATE
  // ====================================================================

  const [form, setForm] = useState({
    report_type: "Report",

    // Report Period(s): reporting/search only; no accounting lock.
    report_periods: [],

    // Posting Period(s): accounting/NetSuite periods; lock validation applies.
    posting_periods: [],

    bp_code: "",
    contract_id: "",
    related_report_number: "",

    // Return only:
    // "automatic" = copy approved linked rows and reverse amounts.
    // "manual"    = user enters Return rows manually.
    return_processing_mode: "automatic",

    note: "",
  });

  const [reportPeriodInput, setReportPeriodInput] = useState("");

  const [postingPeriodInput, setPostingPeriodInput] = useState("");

  const [rows, setRows] = useState([emptyRow()]);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [warnings, setWarnings] = useState([]);

  // ====================================================================
  // ACCOUNTING PERIOD STATE
  // ====================================================================

  const [accountingPeriods, setAccountingPeriods] = useState([]);

  const [periodsLoading, setPeriodsLoading] = useState(false);

  const [periodsLoadError, setPeriodsLoadError] = useState("");

  // ====================================================================
  // SUPPLIER LOOKUP
  // ====================================================================

  const [supplierOptions, setSupplierOptions] = useState([]);

  const [showSupplierOptions, setShowSupplierOptions] = useState(false);

  // ====================================================================
  // CONTRACT LOOKUP
  // ====================================================================

  const [contractOptions, setContractOptions] = useState([]);

  const [showContractOptions, setShowContractOptions] = useState(false);

  // ====================================================================
  // DERIVED VALUES
  // ====================================================================

  const isReport = form.report_type === "Report";

  const isAdjustment = form.report_type === "Adjustment";

  const isReturn = form.report_type === "Return";

  const isManualReturn = isReturn && form.return_processing_mode === "manual";

  const isAutomaticReturn =
    isReturn && form.return_processing_mode === "automatic";

  const requiresManualRows = isReport || isAdjustment || isManualReturn;

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
    ? "Linked Report #"
    : "Linked Original Report #";

  const linkedReportPlaceholder = isReturn
    ? "Enter approved Report or Accrual #"
    : "Enter original report #";

  const periodStatusMap = useMemo(() => {
    const map = new Map();

    accountingPeriods.forEach((item) => {
      map.set(item.period, item);
    });

    return map;
  }, [accountingPeriods]);

  const selectedPostingPeriodRecord = postingPeriodInput
    ? periodStatusMap.get(postingPeriodInput)
    : null;

  const selectedPostingPeriodIsClosed =
    selectedPostingPeriodRecord?.status === PERIOD_STATUS.CLOSED;

  const closedSelectedPostingPeriods = useMemo(
    () =>
      form.posting_periods.filter(
        (selectedPeriod) =>
          periodStatusMap.get(selectedPeriod)?.status === PERIOD_STATUS.CLOSED,
      ),
    [form.posting_periods, periodStatusMap],
  );

  const reportPeriodDisplay = useMemo(
    () => formatPeriodRangeLabel(form.report_periods, "Report Period"),
    [form.report_periods],
  );

  const postingPeriodDisplay = useMemo(
    () => formatPeriodRangeLabel(form.posting_periods, "Posting Period"),
    [form.posting_periods],
  );

  const finalPostingPeriod =
    form.posting_periods.length > 0
      ? normalizePeriods(form.posting_periods)[
          normalizePeriods(form.posting_periods).length - 1
        ]
      : null;

  const openPeriodCount = useMemo(
    () =>
      accountingPeriods.filter((item) => item.status === PERIOD_STATUS.OPEN)
        .length,
    [accountingPeriods],
  );

  const closedPeriodCount = useMemo(
    () =>
      accountingPeriods.filter((item) => item.status === PERIOD_STATUS.CLOSED)
        .length,
    [accountingPeriods],
  );

  // ====================================================================
  // MOST RECENT CLOSED POSTING PERIOD
  // --------------------------------------------------------------------
  // Client requirement:
  // Show only the most recent closed/locked Posting Period.
  //
  // IMPORTANT:
  // accountingPeriods and periodStatusMap still contain ALL periods.
  // All closed periods continue to be blocked from selection.
  // ====================================================================

  const mostRecentClosedPeriod = useMemo(() => {
    const closedPeriods = accountingPeriods
      .filter((item) => item.status === PERIOD_STATUS.CLOSED && item.period)
      .map((item) => item.period)
      .filter(Boolean)
      .sort();

    if (closedPeriods.length === 0) {
      return null;
    }

    return closedPeriods[closedPeriods.length - 1];
  }, [accountingPeriods]);

  // ====================================================================
  // LOAD ACCOUNTING PERIOD STATUS
  // ====================================================================

  const loadAccountingPeriods = async () => {
    setPeriodsLoading(true);
    setPeriodsLoadError("");

    try {
      const data = await apiFetch(apiUrl("/reports/accounting-periods"));

      const normalizedPeriods = normalizePeriodRecords(data);

      setAccountingPeriods(normalizedPeriods);
    } catch (loadError) {
      console.error("Accounting period lookup failed:", loadError);

      setAccountingPeriods([]);

      setPeriodsLoadError(
        loadError?.message || "Unable to load accounting period status.",
      );
    } finally {
      setPeriodsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountingPeriods();
  }, []);

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
         * Return inherits Supplier, Contract, Report Period(s), and
         * Posting Period(s) from the linked approved Report or Accrual.
         */
        if (value === "Return") {
          next.report_periods = [];
          next.posting_periods = [];
          next.bp_code = "";
          next.contract_id = "";
          next.return_processing_mode = "automatic";
        }
      }

      return next;
    });

    if (name === "report_type" && value === "Return") {
      setReportPeriodInput("");
      setPostingPeriodInput("");

      /*
       * Do not carry detail rows from a previous Report/Adjustment into
       * a Return. Manual Return starts with a clean row if selected.
       */
      setRows([emptyRow()]);
    }

    if (
      name === "report_type" &&
      (value === "Report" || value === "Adjustment") &&
      rows.length === 0
    ) {
      setRows([emptyRow()]);
    }
  };

  const handleReturnProcessingModeChange = (mode) => {
    if (!["manual", "automatic"].includes(mode)) {
      return;
    }

    setError("");
    setWarnings([]);

    setForm((previous) => ({
      ...previous,
      return_processing_mode: mode,
    }));

    if (mode === "manual" && rows.length === 0) {
      setRows([emptyRow()]);
    }
  };

  // ====================================================================
  // PERIOD HANDLERS
  // ====================================================================

  const addReportPeriod = () => {
    const selectedPeriod = String(reportPeriodInput || "").trim();

    setError("");
    setWarnings([]);

    if (!selectedPeriod) {
      setError("Select a Report Period before clicking Add.");
      return;
    }

    if (form.report_periods.includes(selectedPeriod)) {
      setError(
        `${formatPeriod(selectedPeriod)} has already been selected as a Report Period.`,
      );
      return;
    }

    setForm((previous) => ({
      ...previous,
      report_periods: normalizePeriods([
        ...previous.report_periods,
        selectedPeriod,
      ]),
    }));

    setReportPeriodInput("");
  };

  const removeReportPeriod = (periodToRemove) => {
    setError("");
    setWarnings([]);

    setForm((previous) => ({
      ...previous,
      report_periods: previous.report_periods.filter(
        (period) => period !== periodToRemove,
      ),
    }));
  };

  const addPostingPeriod = () => {
    const selectedPeriod = String(postingPeriodInput || "").trim();

    setError("");
    setWarnings([]);

    if (!selectedPeriod) {
      setError("Select a Posting Period before clicking Add.");
      return;
    }

    const periodRecord = periodStatusMap.get(selectedPeriod);

    if (periodRecord?.status === PERIOD_STATUS.CLOSED) {
      setError(
        `${formatPeriod(selectedPeriod)} is closed and cannot be selected as a Posting Period.${
          periodRecord.reason ? ` Reason: ${periodRecord.reason}` : ""
        }`,
      );
      return;
    }

    if (form.posting_periods.includes(selectedPeriod)) {
      setError(
        `${formatPeriod(selectedPeriod)} has already been selected as a Posting Period.`,
      );
      return;
    }

    setForm((previous) => ({
      ...previous,
      posting_periods: normalizePeriods([
        ...previous.posting_periods,
        selectedPeriod,
      ]),
    }));

    setPostingPeriodInput("");
  };

  const removePostingPeriod = (periodToRemove) => {
    setError("");
    setWarnings([]);

    setForm((previous) => ({
      ...previous,
      posting_periods: previous.posting_periods.filter(
        (period) => period !== periodToRemove,
      ),
    }));
  };

  const loadContractsForSupplier = async (supplierCode) => {
    const normalizedSupplierCode = String(supplierCode || "").trim();

    setForm((previous) => ({
      ...previous,
      contract_id: "",
    }));

    setContractOptions([]);
    setShowContractOptions(false);

    if (!normalizedSupplierCode) {
      return;
    }

    try {
      const data = await apiFetch(
        apiUrl(
          `/uploads/lookups/contracts?bp_code=${encodeURIComponent(
            normalizedSupplierCode,
          )}`,
        ),
      );

      const contractItems = Array.isArray(data?.items) ? data.items : [];

      setContractOptions(contractItems);

      if (data?.default_contract_id) {
        setForm((previous) => ({
          ...previous,
          contract_id: String(data.default_contract_id),
        }));
      } else if (contractItems.length > 0) {
        setForm((previous) => ({
          ...previous,
          contract_id: String(contractItems[0].contract_id),
        }));
      }
    } catch (lookupError) {
      console.error("Supplier contract lookup failed:", lookupError);

      setContractOptions([]);

      setForm((previous) => ({
        ...previous,
        contract_id: "",
      }));
    }
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
      contract_id: "",
    }));

    setContractOptions([]);
    setShowContractOptions(false);

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

    const selectedSupplierCode = String(form.bp_code || "").trim();

    if (!selectedSupplierCode) {
      setContractOptions([]);
      setShowContractOptions(false);

      return;
    }

    try {
      const data = await apiFetch(
        apiUrl(
          `/uploads/lookups/contracts?bp_code=${encodeURIComponent(
            selectedSupplierCode,
          )}&q=${encodeURIComponent(value || "")}`,
        ),
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
       * Automatically calculate CAF Dollars
       * when Purchase Dollars or CAF changes.
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
     * Automated Return has no user-entered rows.
     * Manual Return uses the same DQ warning rules as manual Report/Adjustment.
     */
    if (isAutomaticReturn) {
      return [];
    }

    const warningList = [];

    const hasValue = (value) =>
      value !== "" &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== "";

    rows.forEach((row, index) => {
      const rowNumber = index + 1;

      // ================================================================
      // DQ CHANGE #1
      // IGNORE ONLY EXPLICIT ZERO-DOLLAR SALES LINES
      // ----------------------------------------------------------------
      // IMPORTANT:
      // Blank values must NOT be treated as zero.
      //
      // Skip DQ only when BOTH values are actually entered
      // and BOTH numeric values equal zero.
      // ================================================================

      const purchaseRaw = String(row.purchase_dollars ?? "")
        .replace(/[$,]/g, "")
        .trim();

      const cafDollarsRaw = String(row.caf_dollars ?? "")
        .replace(/[$,]/g, "")
        .trim();

      const hasPurchaseValue = purchaseRaw !== "";

      const hasCafDollarsValue = cafDollarsRaw !== "";

      const purchaseDollars = hasPurchaseValue ? Number(purchaseRaw) : null;

      const cafDollars = hasCafDollarsValue ? Number(cafDollarsRaw) : null;

      const isZeroDollarLine =
        hasPurchaseValue &&
        hasCafDollarsValue &&
        Number.isFinite(purchaseDollars) &&
        Number.isFinite(cafDollars) &&
        purchaseDollars === 0 &&
        cafDollars === 0;

      if (isZeroDollarLine) {
        return;
      }

      // ================================================================
      // STANDARD REQUIRED FIELDS
      // ----------------------------------------------------------------
      // Validate only the always-required fields here.
      // Address fields are validated conditionally below.
      // ================================================================

      REQUIRED_FIELDS.forEach((field) => {
        if (!CORE_REQUIRED_FIELD_KEYS.has(field.key)) {
          return;
        }

        const value = row[field.key];

        if (!hasValue(value)) {
          warningList.push(`Row ${rowNumber}: ${field.label} is missing.`);
        }
      });

      // ================================================================
      // DQ CHANGE #2
      // MEMBER ADDRESS / SHIP-TO ADDRESS CONDITIONAL VALIDATION
      // ================================================================

      const hasAnyMemberAddress = MEMBER_ADDRESS_FIELD_KEYS.some((fieldKey) =>
        hasValue(row[fieldKey]),
      );

      const hasAnyShipToAddress = SHIP_TO_ADDRESS_FIELD_KEYS.some((fieldKey) =>
        hasValue(row[fieldKey]),
      );

      /*
       * If neither address group is populated, create one DQ warning.
       */
      if (!hasAnyMemberAddress && !hasAnyShipToAddress) {
        warningList.push(
          `Row ${rowNumber}: Member Address or Ship-To Address is required.`,
        );
      }

      /*
       * If the Member Address group is being used, validate only
       * Member Address / City / State / ZIP.
       *
       * Do not generate missing Ship-To warnings.
       */
      if (hasAnyMemberAddress) {
        MEMBER_ADDRESS_FIELD_KEYS.forEach((fieldKey) => {
          const fieldDefinition = REQUIRED_FIELDS.find(
            (field) => field.key === fieldKey,
          );

          if (!hasValue(row[fieldKey])) {
            warningList.push(
              `Row ${rowNumber}: ${
                fieldDefinition?.label || fieldKey
              } is missing.`,
            );
          }
        });
      }

      /*
       * If the Ship-To Address group is being used, validate only
       * Ship To / Address / City / State / ZIP.
       *
       * Do not generate missing Member Address warnings.
       */
      if (hasAnyShipToAddress) {
        SHIP_TO_ADDRESS_FIELD_KEYS.forEach((fieldKey) => {
          const fieldDefinition = REQUIRED_FIELDS.find(
            (field) => field.key === fieldKey,
          );

          if (!hasValue(row[fieldKey])) {
            warningList.push(
              `Row ${rowNumber}: ${
                fieldDefinition?.label || fieldKey
              } is missing.`,
            );
          }
        });
      }

      // ================================================================
      // EXISTING NUMBER VALIDATION
      // ================================================================

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
     * Report and Adjustment require both period concepts.
     * Return inherits both period concepts from the linked Report/Accrual.
     */
    if (
      !isReturn &&
      (!Array.isArray(form.report_periods) || form.report_periods.length === 0)
    ) {
      return "At least one Report Period is required.";
    }

    if (
      !isReturn &&
      (!Array.isArray(form.posting_periods) ||
        form.posting_periods.length === 0)
    ) {
      return "At least one Posting Period is required.";
    }

    /*
     * Only Posting Period(s) are checked against accounting-period locks.
     */
    if (!isReturn && closedSelectedPostingPeriods.length > 0) {
      return `The following Posting Period(s) are closed and cannot be submitted: ${closedSelectedPostingPeriods
        .map(formatPeriod)
        .join(", ")}.`;
    }

    /*
     * Report, Adjustment, and Manual Return require rows.
     */
    if (requiresManualRows && (!Array.isArray(rows) || rows.length === 0)) {
      return "At least one manual detail row is required.";
    }

    /*
     * Adjustment and Return require
     * a linked report.
     */
    if (
      requiresLinkedReport &&
      !String(form.related_report_number || "").trim()
    ) {
      return isReturn
        ? "Linked Report # is required."
        : "Linked Original Report # is required.";
    }

    if (
      requiresLinkedReport &&
      !isPositiveInteger(form.related_report_number)
    ) {
      return isReturn
        ? "Linked Report # must be a positive integer."
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

    const selectedReportPeriods = isReturn
      ? []
      : normalizePeriods(form.report_periods);

    const selectedPostingPeriods = isReturn
      ? []
      : normalizePeriods(form.posting_periods);

    const postingPeriod =
      selectedPostingPeriods.length > 0
        ? selectedPostingPeriods[selectedPostingPeriods.length - 1]
        : null;

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

    const linkedReportNumber = requiresLinkedReport
      ? Number(form.related_report_number)
      : null;

    const payload = {
      report_type: form.report_type,

      // New period model.
      report_periods: selectedReportPeriods,

      posting_periods: selectedPostingPeriods,

      // End/latest Posting Period drives the downstream NetSuite posting date.
      posting_period: postingPeriod,

      bp_code: isReturn ? null : form.bp_code.trim() || null,

      contract_id: isReturn ? null : form.contract_id.trim() || null,

      related_report_number: linkedReportNumber,

      /*
       * Return processing mode is ignored by the backend for non-Return
       * report types.
       */
      return_processing_mode: isReturn ? form.return_processing_mode : null,

      note: form.note.trim() || "",

      validation_warnings: isAutomaticReturn ? [] : warningList,

      validation_error_details: isAutomaticReturn ? "" : warningList.join("\n"),

      /*
       * Automated Return sends no manual rows.
       * Manual Return sends the rows entered by the user.
       */
      rows: isAutomaticReturn ? [] : buildManualRows(),
    };

    try {
      setSaving(true);

      const result = await apiFetch(apiUrl("/reports/manual-create"), {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!isAutomaticReturn && warningList.length > 0) {
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
        disabled={saving}
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
                    ? "The selected report must be an approved Sales Report or Accrual."
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

            {/* RETURN PROCESSING MODE */}

            {isReturn && (
              <div className="md:col-span-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                    <div className="w-full">
                      <p className="font-semibold text-blue-900">
                        Return Processing
                      </p>

                      <p className="mt-1 text-sm text-blue-800">
                        The linked report can be an approved Sales Report or
                        Accrual. Supplier, Contract, Report Period(s), and
                        Posting Period(s) will be inherited from the linked
                        report.
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label
                          className={`cursor-pointer rounded-lg border p-4 transition ${
                            isAutomaticReturn
                              ? "border-indigo-500 bg-white ring-2 ring-indigo-100"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="return_processing_mode"
                              value="automatic"
                              checked={isAutomaticReturn}
                              onChange={() =>
                                handleReturnProcessingModeChange("automatic")
                              }
                              disabled={saving}
                              className="mt-1"
                            />

                            <div>
                              <div className="font-semibold text-slate-900">
                                Automated Reversal
                              </div>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                Copy approved processed rows from the linked
                                report and reverse Purchase Dollars and CAF
                                Dollars automatically.
                              </p>
                            </div>
                          </div>
                        </label>

                        <label
                          className={`cursor-pointer rounded-lg border p-4 transition ${
                            isManualReturn
                              ? "border-indigo-500 bg-white ring-2 ring-indigo-100"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="return_processing_mode"
                              value="manual"
                              checked={isManualReturn}
                              onChange={() =>
                                handleReturnProcessingModeChange("manual")
                              }
                              disabled={saving}
                              className="mt-1"
                            />

                            <div>
                              <div className="font-semibold text-slate-900">
                                Manual Entry
                              </div>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                Enter the Return detail rows manually. The
                                backend will not automatically copy or reverse
                                the linked report rows.
                              </p>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PERIOD SELECTORS */}

            {!isReturn && (
              <div className="md:col-span-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Period Details
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Report Period(s) are used for reporting/searching. Posting
                      Period(s) are accounting periods and control downstream
                      posting.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadAccountingPeriods}
                    disabled={periodsLoading || saving}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {periodsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Refresh posting period status
                  </button>
                </div>

                {/* ACCOUNTING PERIOD STATUS SUMMARY */}

                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                  {periodsLoading ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading posting period status...
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {openPeriodCount} open
                      </span>

                      <span className="inline-flex items-center gap-1 text-red-700">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        {closedPeriodCount} closed
                      </span>
                    </>
                  )}
                </div>

                {periodsLoadError && (
                  <div className="mb-3 flex items-start justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                      <div>
                        <p className="font-medium">
                          Posting period status is unavailable
                        </p>

                        <p className="mt-1">{periodsLoadError}</p>

                        <p className="mt-1 text-xs">
                          Report Period selection remains available. Posting
                          Period selection is also available, but the backend
                          must validate whether the selected accounting period
                          is open or closed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* REPORT PERIOD(S) */}

                  <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-4">
                    <label className="mb-1 block text-sm font-medium text-slate-800">
                      Report Period(s)
                      <span className="ml-1 text-red-500">*</span>
                    </label>

                    <p className="mb-3 text-xs text-slate-500">
                      Used for report search and reporting. Report Periods are
                      not affected by accounting-period locks.
                    </p>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="month"
                        value={reportPeriodInput}
                        onChange={(event) => {
                          setReportPeriodInput(event.target.value);
                          setError("");
                          setWarnings([]);
                        }}
                        className="w-full rounded border px-3 py-2"
                        disabled={saving}
                      />

                      <button
                        type="button"
                        onClick={addReportPeriod}
                        disabled={saving || !reportPeriodInput}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        Add
                      </button>
                    </div>

                    {form.report_periods.length > 0 ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {form.report_periods.map((selectedPeriod) => (
                            <span
                              key={selectedPeriod}
                              className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800"
                            >
                              {formatPeriod(selectedPeriod)}

                              <button
                                type="button"
                                onClick={() =>
                                  removeReportPeriod(selectedPeriod)
                                }
                                disabled={saving}
                                className="rounded-full p-0.5 hover:bg-black/5 disabled:cursor-not-allowed"
                                aria-label={`Remove Report Period ${formatPeriod(
                                  selectedPeriod,
                                )}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 rounded border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800">
                          {reportPeriodDisplay}
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        Select one month or add a beginning and ending month for
                        a Report Period range.
                      </p>
                    )}
                  </div>

                  {/* POSTING PERIOD(S) */}

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                    <label className="mb-1 block text-sm font-medium text-slate-800">
                      Posting Period(s)
                      <span className="ml-1 text-red-500">*</span>
                    </label>

                    <p className="mb-3 text-xs text-slate-500">
                      Used for accounting/NetSuite posting. Closed Posting
                      Periods cannot be selected.
                    </p>

                    {mostRecentClosedPeriod && (
                      <div className="mb-3 flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                        <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                        <span>
                          Most recent locked posting period:{" "}
                          {mostRecentClosedPeriod}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="month"
                        value={postingPeriodInput}
                        onChange={(event) => {
                          setPostingPeriodInput(event.target.value);
                          setError("");
                          setWarnings([]);
                        }}
                        className={`w-full rounded border px-3 py-2 ${
                          selectedPostingPeriodIsClosed
                            ? "border-red-400 bg-red-50"
                            : ""
                        }`}
                        disabled={saving || periodsLoading}
                      />

                      <button
                        type="button"
                        onClick={addPostingPeriod}
                        disabled={
                          saving ||
                          periodsLoading ||
                          selectedPostingPeriodIsClosed ||
                          !postingPeriodInput
                        }
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {selectedPostingPeriodIsClosed ? (
                          <LockKeyhole className="h-4 w-4" />
                        ) : (
                          <CalendarPlus className="h-4 w-4" />
                        )}

                        {selectedPostingPeriodIsClosed
                          ? "Period Closed"
                          : "Add"}
                      </button>
                    </div>

                    {postingPeriodInput && selectedPostingPeriodRecord && (
                      <div
                        className={`mt-2 flex items-start gap-2 rounded p-3 text-sm ${
                          selectedPostingPeriodIsClosed
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {selectedPostingPeriodIsClosed ? (
                          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        )}

                        <div>
                          <p className="font-medium">
                            {formatPeriod(postingPeriodInput)} is{" "}
                            {selectedPostingPeriodIsClosed ? "closed" : "open"}
                          </p>

                          {selectedPostingPeriodRecord.reason && (
                            <p className="mt-1">
                              {selectedPostingPeriodRecord.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {form.posting_periods.length > 0 ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {form.posting_periods.map((selectedPeriod) => {
                            const isClosed =
                              periodStatusMap.get(selectedPeriod)?.status ===
                              PERIOD_STATUS.CLOSED;

                            return (
                              <span
                                key={selectedPeriod}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                                  isClosed
                                    ? "bg-red-50 text-red-700"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isClosed && (
                                  <LockKeyhole className="h-3.5 w-3.5" />
                                )}

                                {formatPeriod(selectedPeriod)}

                                <button
                                  type="button"
                                  onClick={() =>
                                    removePostingPeriod(selectedPeriod)
                                  }
                                  disabled={saving}
                                  className="rounded-full p-0.5 hover:bg-black/5 disabled:cursor-not-allowed"
                                  aria-label={`Remove Posting Period ${formatPeriod(
                                    selectedPeriod,
                                  )}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-3 rounded border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                          <div>{postingPeriodDisplay}</div>

                          {form.posting_periods.length > 1 &&
                            finalPostingPeriod && (
                              <div className="mt-1">
                                NetSuite Posting Period: {finalPostingPeriod}
                              </div>
                            )}
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        Select one month or add a beginning and ending month for
                        a Posting Period range. The ending month is used as the
                        NetSuite posting period.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUPPLIER CODE */}

            {!isReturn && (
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">
                  Supplier
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
                  placeholder="Type Supplier ID or Name"
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
                        onClick={async () => {
                          const selectedSupplierCode = String(
                            supplier.bp_code || "",
                          ).trim();

                          setForm((previous) => ({
                            ...previous,
                            bp_code: selectedSupplierCode,
                            contract_id: "",
                          }));

                          setShowSupplierOptions(false);

                          await loadContractsForSupplier(selectedSupplierCode);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                      >
                        <div className="font-medium text-slate-800">
                          {supplier.display_name ||
                            `${supplier.bp_code} - ${
                              supplier.supplier_name || ""
                            }`}
                        </div>

                        {supplier.supplier_name && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            Supplier ID: {supplier.bp_code}
                          </div>
                        )}
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
            MANUAL ROWS
        ============================================================== */}

        {requiresManualRows && (
          <div className="relative z-10 space-y-4 rounded-lg bg-white p-5 shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Manual Rows</h2>

                <p className="mt-1 text-sm text-slate-500">
                  {isManualReturn
                    ? "Enter the Return detail rows manually. Missing fields generate warnings but do not block submission."
                    : "Missing fields generate warnings but do not block submission."}
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
            <h2 className="text-lg font-semibold">Return Processing Summary</h2>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">
                {isManualReturn ? "Manual Entry" : "Automated Reversal"}
              </p>

              {isManualReturn ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Validate that the linked report is an approved Sales Report
                    or Accrual.
                  </li>

                  <li>
                    Inherit Supplier, Contract, Report Period(s), and Posting
                    Period(s) from the linked report.
                  </li>

                  <li>Use the Return rows entered manually above.</li>

                  <li>
                    Do not automatically copy or reverse the linked report
                    detail rows.
                  </li>

                  <li>
                    Stage the manually entered Return for the scheduled
                    Informatica workflow.
                  </li>
                </ul>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Validate that the linked report is an approved Sales Report
                    or Accrual.
                  </li>

                  <li>
                    Inherit Supplier, Contract, Report Period(s), and Posting
                    Period(s) from the linked report.
                  </li>

                  <li>Copy approved processed rows from Cur_Invoice_Detail.</li>

                  <li>Reverse Purchase Dollars and CAF Dollars.</li>

                  <li>
                    Stage the Return for the scheduled Informatica workflow.
                  </li>
                </ul>
              )}
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
            disabled={
              saving || (!isReturn && closedSelectedPostingPeriods.length > 0)
            }
            className={`rounded px-4 py-2 font-semibold text-white ${
              saving || (!isReturn && closedSelectedPostingPeriods.length > 0)
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
