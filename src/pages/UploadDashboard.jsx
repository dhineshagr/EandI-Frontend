// src/pages/UploadDashboard.jsx
// ======================================================================
// Excel Upload Dashboard – FULL UPDATED WORKING VERSION (PRE-UI)
// ======================================================================

import React, { useCallback, useRef, useState, useEffect } from "react";
import { ContainerClient } from "@azure/storage-blob";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CloudUpload,
  Download,
  FileX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAccount, useMsal } from "@azure/msal-react";

import FilePreviewCard from "../components/upload/FilePreviewCard";
import RecentUploadsCard from "../components/upload/RecentUploadsCard";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

// Toast helper
function useToast() {
  return {
    toast: ({ title, description, variant }) => {
      if (variant === "destructive") {
        alert(`${title}\n${description || ""}`);
      } else {
        console.log(`${title}${description ? " - " + description : ""}`);
      }
    },
  };
}

const MAX_FILE_SIZE_MB = 50;
const ACCEPT = [".xlsx", ".xls", ".csv"];
const SAS_URL = import.meta.env.VITE_AZURE_BLOB_SAS_URL;

// Helpers
function bytesToMB(bytes) {
  return bytes / 1024 / 1024;
}
function sanitize(n) {
  return n.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
}
function buildBlobPath(file) {
  const d = new Date();
  return `${d.getFullYear()}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d
    .getDate()
    .toString()
    .padStart(2, "0")}/${nowIsoCompact()}_${sanitize(file.name)}`;
}

// Required fields
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

// Empty row check
function isEmptyRow(row) {
  const vals = Object.values(row);
  if (vals.some((v) => v && v.toString().toLowerCase().includes("total")))
    return true;

  return vals.every((v) => {
    if (v == null) return true;
    const clean = v.toString().trim().replace(/[$,]/g, "");
    return clean === "" || clean === "-" || clean === "0";
  });
}

// Validate business rules
function validateBusinessRules(file, data, headers) {
  const errors = [];

  REQUIRED_FIELDS.forEach((f) => {
    if (!headers.includes(f)) {
      errors.push(`Row 1: Missing required field: ${f}`);
    }
  });

  data.forEach((row, idx) => {
    if (isEmptyRow(row)) return;

    const rowNumber = idx + 2;
    const purchase = parseFloat(row["purchase_dollars"]) || 0;
    const caf = parseFloat(row["caf"]) || 0;
    const cafDollars = parseFloat(row["caf_dollars"]) || 0;

    const expected = Math.round(purchase * caf * 100) / 100;
    const rounded = Math.round(cafDollars * 100) / 100;

    if (expected !== rounded) {
      errors.push(
        `Row ${rowNumber}: CAF Dollars mismatch (expected ${expected}, got ${rounded})`
      );
    }

    REQUIRED_FIELDS.forEach((f) => {
      if (!row[f] || row[f].toString().trim() === "") {
        errors.push(`Row ${rowNumber}: Missing value for ${f}`);
      }
    });
  });

  return errors;
}

// ======================================================================
// MAIN COMPONENT
// ======================================================================
export default function UploadDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const { instance } = useMsal();
  const msalAccount = useAccount();

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("userProfile");
    return saved ? JSON.parse(saved) : null;
  });

  const isMsalUser = !!msalAccount;

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
      ? "Business Partner"
      : `Internal – ${roleFromClaims || user?.role || "Admin"}`;

  const normalizedRole = String(
    roleFromClaims || user?.role || ""
  ).toLowerCase();

  const canViewValidationDetails =
    userType === "internal" &&
    ["admin", "accounting", "ssp_admins"].includes(normalizedRole);

  // ✅ FIXED ENDPOINT
  const fetchUserProfile = async () => {
    try {
      const data = await apiFetch(apiUrl("/me"));
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem("userProfile", JSON.stringify(data.user));
      }
    } catch (err) {
      console.warn("User profile failed:", err);
      navigate("/login");
    }
  };

  const [recentUploads, setRecentUploads] = useState([]);

  const fetchRecentUploads = async () => {
    try {
      const data = await apiFetch(apiUrl("/uploads/recent"));
      setRecentUploads(data.items || []);
    } catch (err) {
      console.error("Failed to fetch recent uploads:", err);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchRecentUploads();

    const interval = setInterval(fetchRecentUploads, 30000);
    return () => clearInterval(interval);
  }, []);

  const [items, setItems] = useState([]);
  const [lastUploaded, setLastUploaded] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function uploadToAzure(file, user, onProgress) {
    if (!SAS_URL) throw new Error("Missing SAS URL");

    const container = new ContainerClient(SAS_URL);
    const blobClient = container.getBlockBlobClient(buildBlobPath(file));

    await blobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: file.type || "application/octet-stream",
      },
      metadata: {
        uploadedBy: user.username || displayName,
        userType,
        bpCode: user.bp_code || "N/A",
        uploadedAt: new Date().toISOString(),
        source: "excel-ui",
      },
      onProgress: (ev) =>
        onProgress(Math.round((ev.loadedBytes / file.size) * 100)),
    });

    return blobClient.url;
  }

  // =======================================================
  // FILE SELECTION HANDLER (FIX FOR BROWSE + DRAG/DROP)
  // =======================================================
  const onFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;

      setItems([]);
      setLastUploaded(null);

      const file = files[0];

      // =========================
      // Extension validation
      // =========================
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ACCEPT.includes(ext)) {
        toast({
          title: "Invalid file type",
          description: "Only Excel (.xlsx, .xls) or CSV files are allowed.",
          variant: "destructive",
        });
        return;
      }

      // =========================
      // Size validation
      // =========================
      if (bytesToMB(file.size) > MAX_FILE_SIZE_MB) {
        toast({
          title: "File too large",
          description: `Max allowed size is ${MAX_FILE_SIZE_MB} MB.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          const headers = json.length
            ? Object.keys(json[0]).map((h) => h.trim())
            : [];

          // =========================
          // 🔥 RUN VALIDATION HERE
          // =========================
          const errors = validateBusinessRules(file, json, headers);

          const previewRows = json
            .slice(0, 5)
            .map((row) => headers.map((h) => row[h]));

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

          // =========================
          // 🚨 ALERT ON VALIDATION FAIL
          // =========================
          if (errors.length > 0 && canViewValidationDetails) {
            toast({
              title: "Validation failed",
              description: `${errors.length} issue(s) found. Please review errors before uploading.`,
              variant: "destructive",
            });
          }
        } catch (err) {
          toast({
            title: "File read error",
            description: err.message,
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);

      // Reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = "";
    },
    [toast]
  );

  // =======================================================
  // START UPLOAD (AZURE + DB REGISTER)
  // =======================================================
  const startUpload = async (itemId, isZeroSales = false) => {
    try {
      const item = items.find((i) => i.id === itemId);

      if (!item && !isZeroSales) {
        toast({
          title: "No file selected",
          variant: "destructive",
        });
        return;
      }

      let uploadedUrl = null;

      // 1️⃣ Upload to Azure (always allow upload)
      if (!isZeroSales) {
        uploadedUrl = await uploadToAzure(item.file, user, () => {});
      }

      // 2️⃣ Register upload in DB
      await apiFetch(apiUrl("/uploads/register"), {
        method: "POST",
        body: JSON.stringify({
          filename: isZeroSales ? "ZERO_SALES" : item.name,
          report_type: "Members",
          note: isZeroSales ? "Zero Sales Declaration" : "",
        }),
      });

      // 3️⃣ 🔔 SEND VALIDATION EMAIL (THIS WAS MISSING)
      if (item?.validation?.errors?.length > 0) {
        console.warn(
          "Validation issues found - Upload will continue and email will be sent"
        );

        await apiFetch(apiUrl("/notify-accounting"), {
          method: "POST",
          body: JSON.stringify({
            fileName: item.name,
            uploadedBy: displayName,
            errors: item.validation.errors,
          }),
        });
      }

      // 4️⃣ Refresh recent uploads
      await fetchRecentUploads();

      // 5️⃣ Success UI
      setLastUploaded({
        name: isZeroSales ? "Zero Sales Declaration" : item.name,
        url: uploadedUrl,
      });

      setItems([]);

      toast({
        title:
          item?.validation?.errors?.length > 0
            ? "Upload completed with validation issues"
            : "Upload successful",
        description:
          item?.validation?.errors?.length > 0
            ? "File uploaded. Error details have been emailed."
            : undefined,
      });
    } catch (err) {
      console.error("❌ Upload failed:", err);

      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const disabled = !SAS_URL;

  // ======================================================================
  // UI
  // ======================================================================
  return (
    <div className="min-h-[100vh] bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-emerald-600 text-white px-6 py-6">
        <h1 className="text-2xl font-bold">Excel Upload Dashboard</h1>

        <p className="text-sm text-white/80">
          Logged in as: <b>{displayName}</b> ({roleText})
        </p>
      </div>

      {/* MAIN BODY */}
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.6fr] gap-6">
          {/* LEFT SIDE */}
          <div className="space-y-6">
            {/* Upload Card */}
            <div className="rounded-2xl border backdrop-blur bg-white/80 shadow-md">
              <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-transparent">
                <h2 className="font-bold text-lg tracking-tight text-emerald-700 flex items-center gap-2">
                  <Upload className="h-5 w-5" /> Upload Files
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Drag & drop your Excel/CSV or click Browse.
                </p>
              </div>

              <div className="p-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    onFiles(e.dataTransfer.files);
                  }}
                  className={`rounded-2xl p-10 text-center transition border-2 border-dashed ${
                    dragOver
                      ? "border-emerald-500 bg-emerald-50/70 shadow-inner"
                      : "border-slate-300 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-emerald-600" />
                    <p className="text-sm text-slate-500">
                      Drop files here, or
                    </p>

                    <div className="flex gap-3">
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 font-semibold disabled:opacity-60"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                      >
                        <CloudUpload className="mr-2 h-4 w-4" /> Browse…
                      </button>

                      <a
                        href="/templates/member-template.xlsx"
                        download
                        className="text-sm underline flex items-center gap-1 text-indigo-700 hover:text-indigo-800"
                      >
                        Download template <Download className="h-4 w-4" />
                      </a>
                    </div>

                    <input
                      ref={inputRef}
                      type="file"
                      accept={ACCEPT.join(",")}
                      multiple
                      className="hidden"
                      onChange={(e) => onFiles(e.target.files)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Zero Sales Button */}
            {userType === "bp" && (
              <button
                onClick={() => startUpload(null, true)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 px-4 py-2 font-semibold shadow"
              >
                <FileX className="h-4 w-4" /> Submit Zero Sales Declaration
              </button>
            )}

            {/* Last Upload */}
            {lastUploaded && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 shadow p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Upload successful</p>
                  <p className="text-sm">{lastUploaded.name}</p>
                </div>
                <a
                  href={lastUploaded.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline text-sm"
                >
                  View in Azure
                </a>
              </div>
            )}

            {/* Preview Card */}
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

          {/* RIGHT SIDE */}
          <div className="space-y-6">
            <RecentUploadsCard uploads={recentUploads} />
          </div>
        </div>
      </div>
    </div>
  );
}
