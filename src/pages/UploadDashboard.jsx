// src/pages/UploadDashboard.jsx
// ======================================================================
// Excel Upload Dashboard – UPDATED FOR NEW ENHANCEMENTS
// ======================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ContainerClient } from "@azure/storage-blob";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CloudUpload,
  FileX,
  Plus,
  X,
  LockKeyhole,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAccount } from "@azure/msal-react";

import FilePreviewCard from "../components/upload/FilePreviewCard";
import RecentUploadsCard from "../components/upload/RecentUploadsCard";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

/* ======================================================================
   Toast helper
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
   Constants
====================================================================== */

const MAX_FILE_SIZE_MB = 50;
const ACCEPT = [".xlsx", ".xls", ".csv"];
const SAS_URL = import.meta.env.VITE_AZURE_BLOB_SAS_URL;

/* ======================================================================
   Helpers
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

  return `${currentDate.getFullYear()}/${(currentDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${currentDate
    .getDate()
    .toString()
    .padStart(2, "0")}/${nowIsoCompact()}_${sanitize(file.name)}`;
}

function normalizeBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

/* ======================================================================
   Required fields
====================================================================== */

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
   Empty row check
====================================================================== */

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

/* ======================================================================
   Validate business rules
====================================================================== */

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
   Main component
====================================================================== */

export default function UploadDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const msalAccount = useAccount();

  /* --------------------------------------------------------------------
     User state
  -------------------------------------------------------------------- */

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("userProfile");

    return savedUser ? JSON.parse(savedUser) : null;
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
    : user?.user_type?.toLowerCase() || "internal";

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
     Report-level fields
  -------------------------------------------------------------------- */

  const [reportType, setReportType] = useState("Report");

  const [selectedPeriods, setSelectedPeriods] = useState([]);

  const [periodPicker, setPeriodPicker] = useState("");

  const [accountingPeriods, setAccountingPeriods] = useState([]);

  const [bpCode, setBpCode] = useState("");

  const [contractId, setContractId] = useState("");

  /* --------------------------------------------------------------------
     Supplier and contract lookup state
  -------------------------------------------------------------------- */

  const [supplierOptions, setSupplierOptions] = useState([]);

  const [contractOptions, setContractOptions] = useState([]);

  const [showSupplierOptions, setShowSupplierOptions] = useState(false);

  const [showContractOptions, setShowContractOptions] = useState(false);

  const [contractsLoading, setContractsLoading] = useState(false);

  /* --------------------------------------------------------------------
     Upload state
  -------------------------------------------------------------------- */

  const [recentUploads, setRecentUploads] = useState([]);

  const [items, setItems] = useState([]);

  const [lastUploaded, setLastUploaded] = useState(null);

  const [dragOver, setDragOver] = useState(false);

  const [isSubmittingZeroSales, setIsSubmittingZeroSales] = useState(false);

  const inputRef = useRef(null);

  /* --------------------------------------------------------------------
     Locked periods
  -------------------------------------------------------------------- */

  const lockedPeriodSet = new Set(
    accountingPeriods
      .filter((item) => normalizeBoolean(item?.is_locked))
      .map((item) => String(item.period)),
  );

  const lockedPeriods = accountingPeriods
    .filter((item) => normalizeBoolean(item?.is_locked))
    .map((item) => String(item.period))
    .sort();

  /* ====================================================================
     Supplier contract lookup
  ==================================================================== */

  const loadContractsForSupplier = async (supplierCode) => {
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
        `/uploads/lookups/contracts` +
        `?bp_code=${encodeURIComponent(normalizedSupplierCode)}`;

      const data = await apiFetch(apiUrl(endpoint));

      const contractItems = data.items || [];

      setContractOptions(contractItems);

      /*
          Backend returns the newest active
          contract as default_contract_id.
        */
      if (data.default_contract_id) {
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
  };

  /* ====================================================================
     Fetch current user profile
  ==================================================================== */

  const fetchUserProfile = async () => {
    try {
      const data = await apiFetch(apiUrl("/me"));

      if (data?.user) {
        setUser(data.user);

        localStorage.setItem("userProfile", JSON.stringify(data.user));

        /*
            Supplier users automatically use
            the supplier code from login.
          */
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
  };

  /* ====================================================================
     Fetch recent uploads
  ==================================================================== */

  const fetchRecentUploads = async () => {
    try {
      const data = await apiFetch(apiUrl("/uploads/recent"));

      setRecentUploads(data.items || []);
    } catch (error) {
      console.error("Failed to fetch recent uploads:", error);
    }
  };

  /* ====================================================================
     Fetch accounting periods
  ==================================================================== */

  const fetchAccountingPeriods = async () => {
    try {
      const data = await apiFetch(apiUrl("/uploads/periods"));

      setAccountingPeriods(data.items || []);
    } catch (error) {
      console.error("Failed to fetch accounting periods:", error);

      setAccountingPeriods([]);
    }
  };

  /* ====================================================================
     Initial page loading
  ==================================================================== */

  useEffect(() => {
    fetchUserProfile();
    fetchRecentUploads();
    fetchAccountingPeriods();

    const interval = setInterval(fetchRecentUploads, 30000);

    return () => clearInterval(interval);
  }, []);

  /* ====================================================================
     Azure upload
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
     Multi-period selection
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
     Supplier search
  ==================================================================== */

  const searchSuppliers = async (value) => {
    setBpCode(value);

    /*
        Clear the previous contract whenever
        the supplier field changes.
      */
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
        `/uploads/lookups/suppliers` + `?q=${encodeURIComponent(value)}`;

      const data = await apiFetch(apiUrl(endpoint));

      setSupplierOptions(data.items || []);

      setShowSupplierOptions(true);
    } catch (error) {
      console.error("Supplier lookup failed:", error);

      setSupplierOptions([]);
      setShowSupplierOptions(false);
    }
  };

  /* ====================================================================
     Select supplier
  ==================================================================== */

  const selectSupplier = async (supplier) => {
    const selectedCode = String(supplier?.bp_code || "").trim();

    setBpCode(selectedCode);
    setShowSupplierOptions(false);

    await loadContractsForSupplier(selectedCode);
  };

  /* ====================================================================
     Contract search
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
        `/uploads/lookups/contracts` +
        `?bp_code=${encodeURIComponent(selectedSupplierCode)}` +
        `&q=${encodeURIComponent(value || "")}`;

      const data = await apiFetch(apiUrl(endpoint));

      setContractOptions(data.items || []);

      setShowContractOptions(true);
    } catch (error) {
      console.error("Contract lookup failed:", error);

      setContractOptions([]);
      setShowContractOptions(false);
    }
  };

  /* ====================================================================
     File selection handler
  ==================================================================== */

  const onFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) {
        return;
      }

      setItems([]);
      setLastUploaded(null);

      const file = files[0];

      /* --------------------------------------------------------------
         Extension validation
      -------------------------------------------------------------- */

      const extension = file.name
        .toLowerCase()
        .slice(file.name.lastIndexOf("."));

      if (!ACCEPT.includes(extension)) {
        toast({
          title: "Invalid file type",
          description: "Only Excel (.xlsx, .xls) or CSV files are allowed.",
          variant: "destructive",
        });

        return;
      }

      /* --------------------------------------------------------------
         File-size validation
      -------------------------------------------------------------- */

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

      /*
        Reset input so the same file
        can be selected again.
      */
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [toast, canViewValidationDetails],
  );

  /* ====================================================================
     Validate report-level selections
  ==================================================================== */

  const validateReportSelections = () => {
    if (selectedPeriods.length === 0) {
      toast({
        title: "Period required",
        description: "Please select at least one period before submitting.",
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
     Start upload
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

      /* --------------------------------------------------------------
         Upload file to Azure
      -------------------------------------------------------------- */

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

      /* --------------------------------------------------------------
         Register upload in database
      -------------------------------------------------------------- */

      await apiFetch(apiUrl("/uploads/register"), {
        method: "POST",

        body: JSON.stringify({
          filename: isZeroSales ? "ZERO_SALES" : item.name,

          report_type: isZeroSales ? "Zero Sales" : reportType,

          note: isZeroSales ? "Zero Sales Declaration" : "",

          /*
              Maintain backward compatibility
              with the existing period field.
            */
          period: selectedPeriods[0] || null,

          /*
              New multi-period field.
            */
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

      /* --------------------------------------------------------------
         Send validation email
      -------------------------------------------------------------- */

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

      /* --------------------------------------------------------------
         Refresh recent uploads
      -------------------------------------------------------------- */

      await fetchRecentUploads();

      /* --------------------------------------------------------------
         Success UI
      -------------------------------------------------------------- */

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

  /* ====================================================================
     UI
  ==================================================================== */

  return (
    <div className="min-h-[100vh] bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50">
      {/* ================================================================
          Header
      ================================================================ */}

      <div className="bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">Excel Upload Dashboard</h1>

        <p className="text-sm text-white/80">
          Logged in as: <b>{displayName}</b> ({roleText})
        </p>
      </div>

      {/* ================================================================
          Main body
      ================================================================ */}

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1.6fr]">
          {/* ============================================================
              Left side
          ============================================================ */}

          <div className="space-y-6">
            {/* ==========================================================
                Report details
            ========================================================== */}

            <div className="relative z-50 overflow-visible rounded-2xl border bg-white/80 shadow-md backdrop-blur">
              <div className="border-b bg-gradient-to-r from-slate-50 to-transparent p-5">
                <h2 className="text-lg font-bold tracking-tight text-emerald-700">
                  Report Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Provide report-level details before uploading a report,
                  accrual, or Zero Sales Declaration.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                {/* ======================================================
                    Upload type
                ====================================================== */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Upload Type
                  </label>

                  <select
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value)}
                    className="w-full rounded border bg-white px-3 py-2"
                  >
                    <option value="Report">Report</option>

                    <option value="Accrual">Accrual</option>
                  </select>

                  <p className="mt-1 text-xs text-slate-500">
                    Select whether the uploaded file is a standard report or an
                    accrual.
                  </p>
                </div>

                {/* ======================================================
                    Multi-period selection
                ====================================================== */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Periods
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="month"
                      value={periodPicker}
                      onChange={(event) => setPeriodPicker(event.target.value)}
                      className="min-w-0 flex-1 rounded border px-3 py-2"
                    />

                    <button
                      type="button"
                      onClick={addSelectedPeriod}
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  {selectedPeriods.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedPeriods.map((selectedPeriod) => (
                        <span
                          key={selectedPeriod}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                        >
                          {selectedPeriod}

                          <button
                            type="button"
                            onClick={() => removeSelectedPeriod(selectedPeriod)}
                            className="rounded-full p-0.5 hover:bg-emerald-200"
                            aria-label={`Remove ${selectedPeriod}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Add one or more months.
                    </p>
                  )}

                  {lockedPeriods.length > 0 && (
                    <div className="mt-2 flex items-start gap-1 rounded bg-slate-100 p-2 text-xs text-slate-600">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                      <span>Locked periods: {lockedPeriods.join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* ======================================================
                    Supplier
                ====================================================== */}

                <div className="relative">
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
                    className={`w-full rounded border px-3 py-2 ${
                      userType === "bp" ? "bg-slate-100 text-slate-500" : ""
                    }`}
                  />

                  {showSupplierOptions &&
                    userType !== "bp" &&
                    supplierOptions.length > 0 && (
                      <div className="absolute z-[9999] mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
                        {supplierOptions.map((supplier) => (
                          <button
                            key={supplier.bp_code}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectSupplier(supplier)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                          >
                            {supplier.display_name || supplier.bp_code}
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                {/* ======================================================
                    Contract
                ====================================================== */}

                <div className="relative">
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
                    className={`w-full rounded border px-3 py-2 ${
                      !bpCode || contractsLoading
                        ? "bg-slate-100 text-slate-500"
                        : ""
                    }`}
                  />

                  {showContractOptions && contractOptions.length > 0 && (
                    <div className="absolute z-[9999] mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
                      {contractOptions.map((contract) => (
                        <button
                          key={contract.contract_id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setContractId(String(contract.contract_id));

                            setShowContractOptions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
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
                      <p className="mt-1 text-xs text-amber-600">
                        No active contracts were found for this supplier.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* ==========================================================
                Upload card
            ========================================================== */}

            <div className="relative z-10 rounded-2xl border bg-white/80 shadow-md backdrop-blur">
              <div className="border-b bg-gradient-to-r from-slate-50 to-transparent p-5">
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
                  className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
                    dragOver
                      ? "border-emerald-500 bg-emerald-50/70 shadow-inner"
                      : "border-slate-300 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-emerald-600" />

                    <p className="text-sm text-slate-500">Drop file here, or</p>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                      >
                        <CloudUpload className="h-4 w-4" />
                        Browse…
                      </button>
                    </div>

                    <input
                      ref={inputRef}
                      type="file"
                      accept={ACCEPT.join(",")}
                      multiple
                      className="hidden"
                      onChange={(event) => onFiles(event.target.files)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ==========================================================
                Zero Sales
            ========================================================== */}

            <button
              type="button"
              onClick={() => startUpload(null, true)}
              disabled={isSubmittingZeroSales}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileX className="h-4 w-4" />

              {isSubmittingZeroSales
                ? "Submitting..."
                : "Submit Zero Sales Declaration"}
            </button>

            {/* ==========================================================
                Last upload
            ========================================================== */}

            {lastUploaded && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 shadow">
                <div>
                  <p className="font-semibold">Upload successful</p>

                  <p className="text-sm">{lastUploaded.name}</p>
                </div>

                {lastUploaded.url && (
                  <a
                    href={lastUploaded.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-emerald-700 underline"
                  >
                    View in Azure
                  </a>
                )}
              </div>
            )}

            {/* ==========================================================
                Preview card
            ========================================================== */}

            {items.length > 0 && (
              <FilePreviewCard
                item={items[0]}
                onUpload={() => startUpload(items[0].id)}
                disabled={disabled}
                userType={userType}
                canViewValidationDetails={canViewValidationDetails}
                userGroups={user?.groups || user?.roles || []}
              />
            )}
          </div>

          {/* ============================================================
              Right side
          ============================================================ */}

          <div className="space-y-6">
            <RecentUploadsCard uploads={recentUploads} />
          </div>
        </div>
      </div>
    </div>
  );
}
