// src/pages/UploadDashboard.jsx
// ======================================================================
// Upload Dashboard (Updated + FIXED banner name for MSAL users)
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
      if (variant === "destructive") alert(`${title}\n${description || ""}`);
      else console.log(`${title}${description ? " - " + description : ""}`);
    },
  };
}

const MAX_FILE_SIZE_MB = 50;
const ACCEPT = [".xlsx", ".xls", ".csv"];

const SAS_URL = import.meta.env.VITE_AZURE_BLOB_SAS_URL;
const TRIGGER_URL = import.meta.env.VITE_PIPELINE_TRIGGER_URL;

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
    if (!headers.includes(f)) errors.push(`Missing required field: ${f}`);
  });

  data.forEach((row, idx) => {
    if (isEmptyRow(row)) return;
    const purchase = parseFloat(row["purchase_dollars"]) || 0;
    const caf = parseFloat(row["caf"]) || 0;
    const cafDollars = parseFloat(row["caf_dollars"]) || 0;

    const expected = Math.round(purchase * caf * 100) / 100;
    const rounded = Math.round(cafDollars * 100) / 100;

    if (expected !== rounded) {
      errors.push(
        `Row ${
          idx + 2
        }: CAF Dollars mismatch (expected ${expected}, got ${rounded})`
      );
    }

    REQUIRED_FIELDS.forEach((f) => {
      if (!row[f] || row[f].toString().trim() === "") {
        errors.push(`Row ${idx + 2}: Missing value for ${f}`);
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

  // MSAL detection
  const { instance } = useMsal();
  const msalAccount = useAccount();

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("userProfile");
    return saved ? JSON.parse(saved) : null;
  });

  const isMsalUser = !!msalAccount;

  // ----------- Compute Correct Display Name (FIXED) -------------
  const displayName = isMsalUser
    ? msalAccount?.name || "Internal User"
    : user?.fullName || user?.username || "User";

  // Determine role
  let roleFromClaims = undefined;
  if (msalAccount?.idTokenClaims) {
    const claims = msalAccount.idTokenClaims;
    if (Array.isArray(claims.roles) && claims.roles.length > 0)
      roleFromClaims = claims.roles[0];
    else if (claims.role) roleFromClaims = claims.role;
  }

  const isBusinessPartner = !isMsalUser && user?.user_type === "bp";

  const roleText = isBusinessPartner
    ? "Business Partner"
    : `Internal – ${roleFromClaims || user?.role || "Admin"}`;

  // -------------------------------------------------------------

  // Fetch user profile (SQL)
  const fetchUserProfile = async () => {
    try {
      const data = await apiFetch(apiUrl("/auth/me"));
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem("userProfile", JSON.stringify(data.user));
      }
    } catch (err) {
      console.warn("User profile failed:", err);
      navigate("/login");
    }
  };

  // Fetch recent uploads
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

  // File state
  const [items, setItems] = useState([]);
  const [lastUploaded, setLastUploaded] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // Upload file → Azure
  async function uploadToAzure(file, user, onProgress) {
    if (!SAS_URL) throw new Error("Missing SAS URL");

    const container = new ContainerClient(SAS_URL);
    const blobName = buildBlobPath(file);
    const blobClient = container.getBlockBlobClient(blobName);

    await blobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: file.type || "application/octet-stream",
      },
      metadata: {
        uploadedBy: user.username || displayName,
        userType: user.user_type || "internal",
        bpCode: user.bp_code || "N/A",
        uploadedAt: new Date().toISOString(),
        source: "excel-ui",
      },
      onProgress: (ev) => {
        const p = Math.round((ev.loadedBytes / file.size) * 100);
        onProgress(p);
      },
    });

    return blobClient.url;
  }

  // On file drop/selection
  const onFiles = useCallback(
    async (files) => {
      if (!files?.length) return;

      setItems([]);
      setLastUploaded(null);

      const prepared = [];

      for (const file of Array.from(files)) {
        const sizeMB = bytesToMB(file.size);
        const errors = [];

        if (sizeMB > MAX_FILE_SIZE_MB)
          errors.push(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
          errors.push("File must be .xlsx/.xls/.csv");
        }

        try {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          if (json.length > 0) {
            const headers = Object.keys(json[0]).map((h) => h.trim());
            errors.push(...validateBusinessRules(file, json, headers));
          }
        } catch (err) {
          errors.push(`Failed to parse Excel: ${err.message}`);
        }

        prepared.push({
          id:
            crypto.randomUUID?.() ||
            `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          sizeMB: Math.round(sizeMB * 10) / 10,
          status: "ready",
          progress: 0,
          validation: { ok: errors.length === 0, errors },
        });
      }

      setItems(prepared);
      if (inputRef.current) inputRef.current.value = "";
    },
    [user]
  );

  // Upload start
  const startUpload = useCallback(
    async (id, zeroSales = false) => {
      if (!user) return;

      const item = items.find((x) => x.id === id);

      try {
        const url = zeroSales
          ? await uploadToAzure(
              new File([new Blob([`Zero Sales Report`])], "zero_sales.txt"),
              user,
              () => {}
            )
          : await uploadToAzure(item.file, user, (p) => {
              setItems((prev) =>
                prev.map((x) => (x.id === id ? { ...x, progress: p } : x))
              );
            });

        toast({
          title: "Upload successful",
          description: zeroSales
            ? `Zero Sales uploaded`
            : `${item.name} uploaded`,
        });

        setLastUploaded({
          name: zeroSales ? "Zero Sales" : item.name,
          uploadedBy: displayName,
          date: new Date().toISOString(),
          url,
        });

        await apiFetch(apiUrl("/uploads/register"), {
          method: "POST",
          body: JSON.stringify({
            filename: zeroSales ? "Zero Sales" : item.name,
            report_type: zeroSales ? "ZeroSales" : "Sales",
            note: "",
          }),
        });

        fetchRecentUploads();
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [items, user]
  );

  const disabled = !SAS_URL;

  // ======================================================================
  // UI (BANNER FIX APPLIED)
  // ======================================================================
  return (
    <div className="min-h-[100vh] bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50">
      {/* HEADER BANNER */}
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
            {/* Upload card */}
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

            {/* Zero Sales button */}
            {!isMsalUser && user?.user_type === "bp" && (
              <button
                onClick={() => startUpload(null, true)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 px-4 py-2 font-semibold shadow"
              >
                <FileX className="h-4 w-4" /> Submit Zero Sales Declaration
              </button>
            )}

            {/* Last upload */}
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
                userType={user?.user_type}
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
