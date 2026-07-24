// src/pages/UploadDashboard.jsx
// ======================================================================
// Excel Upload Dashboard
// ----------------------------------------------------------------------
// ✔ Responsive layout
// ✔ Report Details displayed full width
// ✔ Prevents Recent Uploads table from collapsing left-side cards
// ✔ Multi-period selection
// ✔ Locked-period validation
// ✔ Supplier and Contract lookup
// ✔ Azure Blob upload
// ✔ Existing functionality preserved
// ======================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ContainerClient } from "@azure/storage-blob";
import * as XLSX from "xlsx";

import {
  CloudUpload,
  FileSpreadsheet,
  FileX,
  LockKeyhole,
  Plus,
  Upload,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAccount } from "@azure/msal-react";

import FilePreviewCard from "../components/upload/FilePreviewCard";
import RecentUploadsCard from "../components/upload/RecentUploadsCard";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

/* ======================================================================
   TOAST HELPER
====================================================================== */

function useToast() {
  return {
    toast: ({ title, description, variant }) => {
      if (variant === "destructive") {
        alert(`${title}\n${description || ""}`);
      } else {
        console.log(`${title}${description ? ` - ${description}` : ""}`);
      }
    },
  };
}

/* ======================================================================
   CONSTANTS
====================================================================== */

const MAX_FILE_SIZE_MB = 50;
const ACCEPT = [".xlsx", ".xls", ".csv"];
const SAS_URL = import.meta.env.VITE_AZURE_BLOB_SAS_URL;

const REQUIRED_FIELDS = [
  "customer_id",
  "member_number",
  "member_name",
  "member_address",
  "member_city",
  "member_state",
  "member_zip",
  "ship_to",
  "ship_to_address",
  "ship_to_city",
  "ship_to_state",
  "ship_to_zip",
  "purchase_dollars",
  "caf",
  "caf_dollars",
];

/* ======================================================================
   HELPERS
====================================================================== */

function bytesToMB(bytes) {
  return bytes / 1024 / 1024;
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
}

function buildBlobPath(file) {
  const currentDate = new Date();

  const year = currentDate.getFullYear();

  const month = String(currentDate.getMonth() + 1).padStart(2, "0");

  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}/${nowIsoCompact()}_${sanitize(file.name)}`;
}

function normalizeBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function getPeriodValue(item) {
  return String(
    item?.period ??
      item?.Period ??
      item?.accounting_period ??
      item?.Accounting_Period ??
      "",
  ).trim();
}

function getLockedValue(item) {
  return normalizeBoolean(
    item?.is_locked ?? item?.Is_Locked ?? item?.locked ?? item?.Locked,
  );
}

function isEmptyRow(row) {
  const values = Object.values(row);

  if (
    values.some(
      (value) => value && value.toString().toLowerCase().includes("total"),
    )
  ) {
    return true;
  }

  return values.every((value) => {
    if (value == null) {
      return true;
    }

    const cleanValue = value.toString().trim().replace(/[$,]/g, "");

    return cleanValue === "" || cleanValue === "-" || cleanValue === "0";
  });
}

function validateBusinessRules(file, data, headers) {
  const errors = [];

  REQUIRED_FIELDS.forEach((field) => {
    if (!headers.includes(field)) {
      errors.push(`Row 1: Missing required field: ${field}`);
    }
  });

  data.forEach((row, index) => {
    if (isEmptyRow(row)) {
      return;
    }

    const rowNumber = index + 2;

    const purchase = parseFloat(row.purchase_dollars) || 0;

    const caf = parseFloat(row.caf) || 0;

    const cafDollars = parseFloat(row.caf_dollars) || 0;

    /*
     * Existing uploaded templates store CAF as a decimal rate,
     * for example 0.05 for 5%.
     */
    const expected = Math.round(purchase * caf * 100) / 100;

    const rounded = Math.round(cafDollars * 100) / 100;

    if (expected !== rounded) {
      errors.push(
        `Row ${rowNumber}: CAF Dollars mismatch ` +
          `(expected ${expected}, got ${rounded})`,
      );
    }

    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field] || row[field].toString().trim() === "") {
        errors.push(`Row ${rowNumber}: Missing value for ${field}`);
      }
    });
  });

  return errors;
}

/* ======================================================================
   MAIN COMPONENT
====================================================================== */

export default function UploadDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const msalAccount = useAccount();

  /* --------------------------------------------------------------------
     USER STATE
  -------------------------------------------------------------------- */

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("userProfile");

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("userProfile");
      return null;
    }
  });

  const isMsalUser = Boolean(msalAccount);

  const displayName = isMsalUser
    ? msalAccount?.name ||
      user?.display_name ||
      user?.username ||
      "Internal User"
    : user?.display_name || user?.username || user?.email || "User";

  const userType = isMsalUser
    ? "internal"
    : String(user?.user_type || "internal").toLowerCase();

  let roleFromClaims;

  if (msalAccount?.idTokenClaims) {
    const claims = msalAccount.idTokenClaims;

    roleFromClaims = claims?.roles?.[0] || claims?.role || undefined;
  }

  const roleText =
    userType === "bp"
      ? "Supplier"
      : `Internal – ${roleFromClaims || user?.role || "Admin"}`;

  const normalizedRole = String(roleFromClaims || user?.role || "")
    .toLowerCase()
    .trim();

  const canViewValidationDetails =
    userType === "internal" &&
    ["admin", "accounting", "ssp_admins"].includes(normalizedRole);

  /* --------------------------------------------------------------------
     REPORT-LEVEL STATE
  -------------------------------------------------------------------- */

  const [reportType, setReportType] = useState("Report");

  const [selectedPeriods, setSelectedPeriods] = useState([]);

  const [periodPicker, setPeriodPicker] = useState("");

  const [accountingPeriods, setAccountingPeriods] = useState([]);

  const [bpCode, setBpCode] = useState("");

  const [contractId, setContractId] = useState("");

  /* --------------------------------------------------------------------
     LOOKUP STATE
  -------------------------------------------------------------------- */

  const [supplierOptions, setSupplierOptions] = useState([]);

  const [contractOptions, setContractOptions] = useState([]);

  const [showSupplierOptions, setShowSupplierOptions] = useState(false);

  const [showContractOptions, setShowContractOptions] = useState(false);

  const [contractsLoading, setContractsLoading] = useState(false);

  /* --------------------------------------------------------------------
     UPLOAD STATE
  -------------------------------------------------------------------- */

  const [recentUploads, setRecentUploads] = useState([]);

  const [items, setItems] = useState([]);

  const [lastUploaded, setLastUploaded] = useState(null);

  const [dragOver, setDragOver] = useState(false);

  const [isSubmittingZeroSales, setIsSubmittingZeroSales] = useState(false);

  const inputRef = useRef(null);

  /* --------------------------------------------------------------------
     LOCKED PERIODS
  -------------------------------------------------------------------- */

  const configuredPeriodSet = useMemo(
    () => new Set(accountingPeriods.map(getPeriodValue).filter(Boolean)),
    [accountingPeriods],
  );

  const lockedPeriodSet = useMemo(
    () =>
      new Set(
        accountingPeriods
          .filter(getLockedValue)
          .map(getPeriodValue)
          .filter(Boolean),
      ),
    [accountingPeriods],
  );

  const openPeriodSet = useMemo(
    () =>
      new Set(
        accountingPeriods
          .filter((item) => !getLockedValue(item))
          .map(getPeriodValue)
          .filter(Boolean),
      ),
    [accountingPeriods],
  );

  const lockedPeriods = useMemo(
    () =>
      accountingPeriods
        .filter(getLockedValue)
        .map(getPeriodValue)
        .filter(Boolean)
        .sort(),
    [accountingPeriods],
  );
  /* ====================================================================
     CONTRACTS FOR SUPPLIER
  ==================================================================== */

  const loadContractsForSupplier = useCallback(async (supplierCode) => {
    const normalizedSupplierCode = String(supplierCode || "").trim();

    setContractId("");
    setContractOptions([]);
    setShowContractOptions(false);

    if (!normalizedSupplierCode) {
      return;
    }

    setContractsLoading(true);

    try {
      const endpoint =
        "/uploads/lookups/contracts" +
        `?bp_code=${encodeURIComponent(normalizedSupplierCode)}`;

      const data = await apiFetch(apiUrl(endpoint));

      const contractItems = Array.isArray(data?.items) ? data.items : [];

      setContractOptions(contractItems);

      if (data?.default_contract_id) {
        setContractId(String(data.default_contract_id));
      } else if (contractItems.length > 0) {
        setContractId(String(contractItems[0].contract_id));
      }
    } catch (error) {
      console.error("Supplier contract lookup failed:", error);

      setContractOptions([]);
      setContractId("");
    } finally {
      setContractsLoading(false);
    }
  }, []);

  /* ====================================================================
     FETCH USER PROFILE
  ==================================================================== */

  const fetchUserProfile = useCallback(async () => {
    try {
      const data = await apiFetch(apiUrl("/me"));

      if (data?.user) {
        setUser(data.user);

        localStorage.setItem("userProfile", JSON.stringify(data.user));

        if (
          String(data.user?.user_type || "").toLowerCase() === "bp" &&
          data.user?.bp_code
        ) {
          const userBpCode = String(data.user.bp_code);

          setBpCode(userBpCode);

          await loadContractsForSupplier(userBpCode);
        }
      }
    } catch (error) {
      console.warn("User profile failed:", error);

      navigate("/login");
    }
  }, [loadContractsForSupplier, navigate]);

  /* ====================================================================
     FETCH RECENT UPLOADS
  ==================================================================== */

  const fetchRecentUploads = useCallback(async () => {
    try {
      const data = await apiFetch(apiUrl("/uploads/recent"));

      setRecentUploads(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error("Failed to fetch recent uploads:", error);
    }
  }, []);

  /* ====================================================================
     FETCH ACCOUNTING PERIODS
  ==================================================================== */

  const fetchAccountingPeriods = useCallback(async () => {
    try {
      /*
       * Use the existing Upload Dashboard accounting-period endpoint.
       * This preserves the endpoint and response format already used
       * by the upload workflow.
       */
      const data = await apiFetch(apiUrl("/uploads/periods"));

      if (!data) {
        throw new Error("Your session may have expired. Please sign in again.");
      }

      /*
       * Support all known response formats:
       *
       * { items: [...] }
       * { periods: [...] }
       * [...]
       */
      const periodItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.periods)
          ? data.periods
          : Array.isArray(data)
            ? data
            : [];

      console.log("Upload accounting periods:", periodItems);

      setAccountingPeriods(periodItems);
    } catch (error) {
      console.error("Failed to fetch accounting periods:", error);

      setAccountingPeriods([]);
    }
  }, []);

  /* ====================================================================
     INITIAL LOAD
  ==================================================================== */

  useEffect(() => {
    fetchUserProfile();
    fetchRecentUploads();
    fetchAccountingPeriods();

    const recentUploadsInterval = setInterval(fetchRecentUploads, 30000);

    const accountingPeriodsInterval = setInterval(
      fetchAccountingPeriods,
      60000,
    );

    return () => {
      clearInterval(recentUploadsInterval);
      clearInterval(accountingPeriodsInterval);
    };
  }, [fetchUserProfile, fetchRecentUploads, fetchAccountingPeriods]);

  /* ====================================================================
     AZURE UPLOAD
  ==================================================================== */

  async function uploadToAzure(file, currentUser, onProgress) {
    if (!SAS_URL) {
      throw new Error("Missing Azure Blob SAS URL");
    }

    const container = new ContainerClient(SAS_URL);

    const blobClient = container.getBlockBlobClient(buildBlobPath(file));

    await blobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: file.type || "application/octet-stream",
      },

      metadata: {
        uploadedBy: currentUser?.username || currentUser?.email || displayName,

        userType,

        bpCode: currentUser?.bp_code || bpCode || "N/A",

        uploadedAt: new Date().toISOString(),

        source: "excel-ui",
      },

      onProgress: (event) => {
        const progress = Math.round((event.loadedBytes / file.size) * 100);

        onProgress(progress);
      },
    });

    return blobClient.url;
  }

  /* ====================================================================
     PERIOD HANDLERS
  ==================================================================== */

  const addSelectedPeriod = () => {
    const selectedPeriod = String(periodPicker || "").trim();

    if (!selectedPeriod) {
      toast({
        title: "Period required",
        description: "Please choose a month before clicking Add.",
        variant: "destructive",
      });

      return;
    }

    if (!configuredPeriodSet.has(selectedPeriod)) {
      toast({
        title: "Period is not configured",
        description:
          `${selectedPeriod} has not been configured. ` +
          "Please select a configured accounting period.",
        variant: "destructive",
      });

      return;
    }

    if (lockedPeriodSet.has(selectedPeriod)) {
      toast({
        title: "Period is locked",
        description: `${selectedPeriod} is locked and cannot be selected.`,
        variant: "destructive",
      });

      return;
    }

    setSelectedPeriods((previousPeriods) => {
      if (previousPeriods.includes(selectedPeriod)) {
        toast({
          title: "Period already selected",
          description: `${selectedPeriod} has already been added.`,
        });

        return previousPeriods;
      }

      return [...previousPeriods, selectedPeriod].sort();
    });

    setPeriodPicker("");
  };

  const removeSelectedPeriod = (periodToRemove) => {
    setSelectedPeriods((previousPeriods) =>
      previousPeriods.filter((period) => period !== periodToRemove),
    );
  };

  /* ====================================================================
     SUPPLIER SEARCH
  ==================================================================== */

  const searchSuppliers = async (value) => {
    setBpCode(value);

    setContractId("");
    setContractOptions([]);
    setShowContractOptions(false);

    if (!value || value.trim().length < 1) {
      setSupplierOptions([]);
      setShowSupplierOptions(false);
      return;
    }

    try {
      const endpoint =
        "/uploads/lookups/suppliers" + `?q=${encodeURIComponent(value)}`;

      const data = await apiFetch(apiUrl(endpoint));

      setSupplierOptions(Array.isArray(data?.items) ? data.items : []);

      setShowSupplierOptions(true);
    } catch (error) {
      console.error("Supplier lookup failed:", error);

      setSupplierOptions([]);
      setShowSupplierOptions(false);
    }
  };

  const selectSupplier = async (supplier) => {
    const selectedCode = String(supplier?.bp_code || "").trim();

    setBpCode(selectedCode);
    setShowSupplierOptions(false);

    await loadContractsForSupplier(selectedCode);
  };

  /* ====================================================================
     CONTRACT SEARCH
  ==================================================================== */

  const searchContracts = async (value) => {
    setContractId(value);

    const selectedSupplierCode =
      userType === "bp" ? user?.bp_code || bpCode : bpCode;

    if (!selectedSupplierCode) {
      setContractOptions([]);
      setShowContractOptions(false);
      return;
    }

    try {
      const endpoint =
        "/uploads/lookups/contracts" +
        `?bp_code=${encodeURIComponent(selectedSupplierCode)}` +
        `&q=${encodeURIComponent(value || "")}`;

      const data = await apiFetch(apiUrl(endpoint));

      setContractOptions(Array.isArray(data?.items) ? data.items : []);

      setShowContractOptions(true);
    } catch (error) {
      console.error("Contract lookup failed:", error);

      setContractOptions([]);
      setShowContractOptions(false);
    }
  };

  /* ====================================================================
     FILE SELECTION
  ==================================================================== */

  const onFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) {
        return;
      }

      setItems([]);
      setLastUploaded(null);

      const file = files[0];

      const lastDotIndex = file.name.lastIndexOf(".");

      const extension =
        lastDotIndex >= 0 ? file.name.toLowerCase().slice(lastDotIndex) : "";

      if (!ACCEPT.includes(extension)) {
        toast({
          title: "Invalid file type",
          description: "Only Excel (.xlsx, .xls) or CSV files are allowed.",
          variant: "destructive",
        });

        return;
      }

      if (bytesToMB(file.size) > MAX_FILE_SIZE_MB) {
        toast({
          title: "File too large",
          description: `Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`,
          variant: "destructive",
        });

        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target.result, {
            type: "array",
          });

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];

          const json = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });

          const headers =
            json.length > 0
              ? Object.keys(json[0]).map((header) => header.trim())
              : [];

          const errors = validateBusinessRules(file, json, headers);

          const previewRows = json
            .slice(0, 5)
            .map((row) => headers.map((header) => row[header]));

          const validation = {
            ok: errors.length === 0,
            errors,
            rowCount: json.length,
          };

          setItems([
            {
              id: Date.now(),
              file,
              name: file.name,

              sizeMB: Math.round(bytesToMB(file.size) * 10) / 10,

              status: validation.ok ? "ready" : "error",

              progress: 0,

              validation,

              preview: {
                headers,
                rows: previewRows,
              },

              error: validation.ok ? null : "Validation failed",
            },
          ]);

          if (errors.length > 0 && canViewValidationDetails) {
            toast({
              title: "Validation failed",

              description:
                `${errors.length} issue(s) found. ` +
                "Please review errors before uploading.",

              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "File read error",
            description: error.message,
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [toast, canViewValidationDetails],
  );

  /* ====================================================================
     VALIDATE REPORT SELECTIONS
  ==================================================================== */

  const validateReportSelections = () => {
    if (selectedPeriods.length === 0) {
      toast({
        title: "Period required",
        description:
          "Please select at least one accounting period before submitting.",
        variant: "destructive",
      });

      return false;
    }

    const unconfiguredSelections = selectedPeriods.filter(
      (period) => !configuredPeriodSet.has(period),
    );

    if (unconfiguredSelections.length > 0) {
      toast({
        title: "Unconfigured period selected",
        description:
          "Remove the unconfigured period(s): " +
          unconfiguredSelections.join(", "),
        variant: "destructive",
      });

      return false;
    }

    const lockedSelections = selectedPeriods.filter((period) =>
      lockedPeriodSet.has(period),
    );

    if (lockedSelections.length > 0) {
      toast({
        title: "Locked period selected",

        description:
          "Remove the locked period(s): " + lockedSelections.join(", "),

        variant: "destructive",
      });

      return false;
    }

    return true;
  };

  /* ====================================================================
     START UPLOAD
  ==================================================================== */

  const startUpload = async (itemId, isZeroSales = false) => {
    try {
      const item = items.find((currentItem) => currentItem.id === itemId);

      if (!item && !isZeroSales) {
        toast({
          title: "No file selected",
          description: "Please select a file before uploading.",
          variant: "destructive",
        });

        return;
      }

      if (!validateReportSelections()) {
        return;
      }

      const resolvedBpCode =
        userType === "bp" ? user?.bp_code || bpCode || null : bpCode || null;

      let uploadedUrl = null;

      if (isZeroSales) {
        setIsSubmittingZeroSales(true);
      }

      if (!isZeroSales) {
        setItems((previousItems) =>
          previousItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  status: "uploading",
                  progress: 0,
                }
              : currentItem,
          ),
        );

        uploadedUrl = await uploadToAzure(item.file, user, (progress) => {
          setItems((previousItems) =>
            previousItems.map((currentItem) =>
              currentItem.id === item.id
                ? {
                    ...currentItem,
                    status: "uploading",
                    progress,
                  }
                : currentItem,
            ),
          );
        });
      }

      await apiFetch(apiUrl("/uploads/register"), {
        method: "POST",

        body: JSON.stringify({
          filename: isZeroSales ? "ZERO_SALES" : item.name,

          report_type: isZeroSales ? "Zero Sales" : reportType,

          note: isZeroSales ? "Zero Sales Declaration" : "",

          period: selectedPeriods[0] || null,

          periods: selectedPeriods,

          bp_code: resolvedBpCode,

          contract_id: contractId || null,
        }),
      });

      if (!isZeroSales) {
        setItems((previousItems) =>
          previousItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  status: "processing",
                  progress: 100,
                }
              : currentItem,
          ),
        );
      }

      if (item?.validation?.errors?.length > 0) {
        console.warn(
          "Validation issues found. Upload will continue and email will be sent.",
        );

        try {
          await apiFetch(apiUrl("/notify-accounting"), {
            method: "POST",

            body: JSON.stringify({
              fileName: item.name,

              uploadedBy: displayName,

              errors: item.validation.errors.slice(0, 200),
            }),
          });
        } catch (emailError) {
          console.warn(
            "Validation email failed, but upload completed:",
            emailError,
          );
        }
      }

      await fetchRecentUploads();

      setLastUploaded({
        name: isZeroSales ? "Zero Sales Declaration" : item.name,

        url: uploadedUrl,
      });

      if (!isZeroSales) {
        setTimeout(() => {
          setItems([]);
        }, 3000);
      }

      toast({
        title:
          item?.validation?.errors?.length > 0
            ? "Upload completed with validation issues"
            : "Upload successful",

        description:
          item?.validation?.errors?.length > 0
            ? "File uploaded. Error details have been emailed."
            : isZeroSales
              ? "Zero Sales Declaration was submitted successfully."
              : undefined,
      });
    } catch (error) {
      console.error("Upload failed:", error);

      toast({
        title: "Upload failed",

        description: error?.message || "An unexpected error occurred.",

        variant: "destructive",
      });
    } finally {
      setIsSubmittingZeroSales(false);
    }
  };

  const disabled = !SAS_URL;

  const selectedPickerPeriod = String(periodPicker || "").trim();

  const periodPickerStatus = useMemo(() => {
    if (!selectedPickerPeriod) {
      return null;
    }

    if (!configuredPeriodSet.has(selectedPickerPeriod)) {
      return {
        type: "not-configured",
        label: "Not configured",
        message: "This accounting period has not been configured.",
      };
    }

    if (lockedPeriodSet.has(selectedPickerPeriod)) {
      return {
        type: "locked",
        label: "Locked",
        message: "Reports cannot be submitted for this period.",
      };
    }

    return {
      type: "open",
      label: "Open",
      message: "This accounting period is available for submission.",
    };
  }, [configuredPeriodSet, lockedPeriodSet, selectedPickerPeriod]);

  /* ====================================================================
     UI
  ==================================================================== */

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50">
      {/* PAGE HEADER */}
      <header className="bg-gradient-to-r from-indigo-600 to-emerald-600 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <h1 className="text-xl font-bold sm:text-2xl">
            Excel Upload Dashboard
          </h1>

          <p className="mt-1 text-sm text-white/85">
            Logged in as: <strong>{displayName}</strong> ({roleText})
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ==============================================================
            REPORT DETAILS — FULL WIDTH
        ============================================================== */}
        <section className="relative z-30 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <h2 className="text-lg font-bold tracking-tight text-emerald-700">
              Report Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Provide report-level details before uploading a report, accrual,
              or Zero Sales Declaration.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {/* UPLOAD TYPE */}
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Upload Type
              </label>

              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="Report">Report</option>

                <option value="Accrual">Accrual</option>
              </select>

              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Select whether the uploaded file is a standard report or an
                accrual.
              </p>
            </div>

            {/* MULTI-PERIOD */}
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Period(s)
                <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  type="month"
                  value={periodPicker}
                  onChange={(event) => setPeriodPicker(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <button
                  type="button"
                  onClick={addSelectedPeriod}
                  disabled={
                    !selectedPickerPeriod ||
                    !openPeriodSet.has(selectedPickerPeriod)
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {periodPickerStatus && (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                    periodPickerStatus.type === "open"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : periodPickerStatus.type === "locked"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {periodPickerStatus.type === "locked" && (
                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}

                  <span>
                    <strong>{periodPickerStatus.label}:</strong>{" "}
                    {periodPickerStatus.message}
                  </span>
                </div>
              )}

              {selectedPeriods.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedPeriods.map((selectedPeriod) => (
                    <span
                      key={selectedPeriod}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                    >
                      <span className="truncate">{selectedPeriod}</span>

                      <button
                        type="button"
                        onClick={() => removeSelectedPeriod(selectedPeriod)}
                        className="shrink-0 rounded-full p-0.5 hover:bg-emerald-200"
                        aria-label={`Remove ${selectedPeriod}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">
                  Select and add one or more months.
                </p>
              )}

              {lockedPeriods.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <span className="min-w-0 break-words">
                    Locked periods: {lockedPeriods.join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* SUPPLIER */}
            <div className="relative min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Supplier
              </label>

              <input
                type="text"
                value={
                  userType === "bp" ? user?.bp_code || bpCode || "" : bpCode
                }
                onChange={(event) => searchSuppliers(event.target.value)}
                onFocus={() => {
                  if (supplierOptions.length > 0) {
                    setShowSupplierOptions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSupplierOptions(false), 200);
                }}
                disabled={userType === "bp"}
                placeholder={
                  userType === "bp"
                    ? "Auto-filled from login"
                    : "Type Supplier ID or Name"
                }
                className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
                  userType === "bp"
                    ? "cursor-not-allowed bg-slate-100 text-slate-500"
                    : "bg-white"
                }`}
              />

              {showSupplierOptions &&
                userType !== "bp" &&
                supplierOptions.length > 0 && (
                  <div className="absolute left-0 right-0 z-[9999] mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {supplierOptions.map((supplier) => (
                      <button
                        key={supplier.bp_code}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSupplier(supplier)}
                        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                      >
                        {supplier.display_name || supplier.bp_code}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* CONTRACT */}
            <div className="relative min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Contract ID
              </label>

              <input
                type="text"
                value={contractId}
                onChange={(event) => searchContracts(event.target.value)}
                onFocus={() => {
                  if (contractOptions.length > 0) {
                    setShowContractOptions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowContractOptions(false), 200);
                }}
                disabled={!bpCode || contractsLoading}
                placeholder={
                  contractsLoading
                    ? "Loading contracts..."
                    : bpCode
                      ? "Type Contract ID"
                      : "Select Supplier first"
                }
                className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
                  !bpCode || contractsLoading
                    ? "cursor-not-allowed bg-slate-100 text-slate-500"
                    : "bg-white"
                }`}
              />

              {showContractOptions && contractOptions.length > 0 && (
                <div className="absolute left-0 right-0 z-[9999] mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                  {contractOptions.map((contract) => (
                    <button
                      key={contract.contract_id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setContractId(String(contract.contract_id));

                        setShowContractOptions(false);
                      }}
                      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                    >
                      <span className="font-medium">
                        {contract.contract_id}
                      </span>

                      {contract.is_default && (
                        <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          Newest
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {bpCode &&
                !contractsLoading &&
                contractOptions.length === 0 &&
                !contractId && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    No active contracts were found for this supplier.
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* ==============================================================
            LOWER RESPONSIVE GRID
        ============================================================== */}
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,2.2fr)]">
          {/* LEFT COLUMN */}
          <div className="min-w-0 space-y-6">
            {/* UPLOAD CARD */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-emerald-700">
                  <Upload className="h-5 w-5" />
                  Upload Files
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Drag and drop your Excel or CSV file, or click Browse.
                </p>
              </div>

              <div className="p-5">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();

                    setDragOver(false);

                    onFiles(event.dataTransfer.files);
                  }}
                  className={`rounded-2xl border-2 border-dashed px-4 py-10 text-center transition sm:px-8 ${
                    dragOver
                      ? "border-emerald-500 bg-emerald-50 shadow-inner"
                      : "border-slate-300 bg-slate-50/40 hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-emerald-600" />

                    <p className="text-sm text-slate-500">Drop file here, or</p>

                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={disabled}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CloudUpload className="h-4 w-4" />
                      Browse…
                    </button>

                    <p className="text-xs text-slate-400">
                      Excel or CSV, maximum {MAX_FILE_SIZE_MB} MB
                    </p>

                    <input
                      ref={inputRef}
                      type="file"
                      accept={ACCEPT.join(",")}
                      className="hidden"
                      onChange={(event) => onFiles(event.target.files)}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ZERO SALES */}
            <button
              type="button"
              onClick={() => startUpload(null, true)}
              disabled={isSubmittingZeroSales}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileX className="h-4 w-4" />

              {isSubmittingZeroSales
                ? "Submitting..."
                : "Submit Zero Sales Declaration"}
            </button>

            {/* LAST UPLOAD */}
            {lastUploaded && (
              <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 shadow sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">Upload successful</p>

                  <p className="truncate text-sm">{lastUploaded.name}</p>
                </div>

                {lastUploaded.url && (
                  <a
                    href={lastUploaded.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-emerald-700 underline"
                  >
                    View in Azure
                  </a>
                )}
              </div>
            )}

            {/* PREVIEW */}
            {items.length > 0 && (
              <div className="min-w-0 overflow-hidden">
                <FilePreviewCard
                  item={items[0]}
                  onUpload={() => startUpload(items[0].id)}
                  disabled={disabled}
                  userType={userType}
                  canViewValidationDetails={canViewValidationDetails}
                  userGroups={user?.groups || user?.roles || []}
                />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="min-w-0 overflow-hidden">
            <RecentUploadsCard uploads={recentUploads} />
          </div>
        </div>
      </main>
    </div>
  );
}
