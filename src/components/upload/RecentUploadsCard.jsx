// src/components/upload/RecentUploadsCard.jsx

import React, { useEffect, useMemo, useState } from "react";

import { apiUrl } from "../../api/config";

/* ======================================================================
   Helpers
====================================================================== */

function normalizePeriods(upload) {
  if (Array.isArray(upload?.periods)) {
    return [
      ...new Set(
        upload.periods
          .map((period) => String(period || "").trim())
          .filter(Boolean),
      ),
    ].sort();
  }

  const selectedPeriods =
    upload?.selected_periods || upload?.selectedPeriods || "";

  if (selectedPeriods) {
    return [
      ...new Set(
        String(selectedPeriods)
          .split(",")
          .map((period) => period.trim())
          .filter(Boolean),
      ),
    ].sort();
  }

  /*
    Backward compatibility for older reports.
    Only use the old Period value when it is a valid YYYY-MM period.
    We should not split summary text such as "3 periods".
  */
  const oldPeriod = String(upload?.period || "").trim();

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(oldPeriod)) {
    return [oldPeriod];
  }

  return [];
}

function getFriendlyReportType(upload) {
  const reportType = String(upload?.report_type || upload?.reportType || "")
    .trim()
    .toLowerCase();

  const filename = String(upload?.filename || upload?.name || "")
    .trim()
    .toUpperCase();

  /*
    Existing Zero Sales records use:
    Report_Type = Members
    Filename = ZERO_SALES
  */
  if (filename === "ZERO_SALES" || filename.includes("ZERO_SALES")) {
    return "Zero Sales";
  }

  if (reportType === "members") {
    return "Report";
  }

  if (reportType === "accrual") {
    return "Accrual";
  }

  if (reportType === "return") {
    return "Return";
  }

  return upload?.report_type || upload?.reportType || "Report";
}

function getStatusDisplay(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  const displayValues = {
    new: "New",
    processing: "Processing",
    processed: "Processed",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    failed: "Failed",
    error: "Error",
    completed: "Completed",
  };

  return displayValues[normalizedStatus] || status || "—";
}

function getStatusClass(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (["processed", "approved", "completed"].includes(normalizedStatus)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["failed", "error", "rejected"].includes(normalizedStatus)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (["processing", "pending"].includes(normalizedStatus)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getPeriodDisplay(upload) {
  if (upload.periods?.length > 0) {
    return upload.periods.join(", ");
  }

  return upload.period || "—";
}

/* ======================================================================
   Main component
====================================================================== */

export default function RecentUploadsCard({ uploads }) {
  const [sortField, setSortField] = useState("date");

  const [sortOrder, setSortOrder] = useState("desc");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(5);

  const [downloadingKey, setDownloadingKey] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [uploads]);

  /* ====================================================================
     Normalize backend data
  ==================================================================== */

  const normalizedUploads = useMemo(
    () =>
      (uploads || []).map((upload, index) => {
        const periods = normalizePeriods(upload);

        const reportNumber =
          upload.report_number || upload.reportNumber || null;

        const filename = upload.filename || upload.name || "—";

        return {
          id:
            reportNumber ||
            `${filename}-${upload.uploaded_at_utc || upload.date || index}`,

          reportNumber,

          name: filename,

          reportType: getFriendlyReportType(upload),

          rawReportType: upload.report_type || upload.reportType || "",

          periods,

          period: upload.period || "",

          periodDisplay:
            periods.length > 0 ? periods.join(", ") : upload.period || "—",

          supplier: upload.bp_code || upload.bpCode || "—",

          contract: upload.contract_id || upload.contractId || "—",

          relatedReportNumber:
            upload.related_report_number || upload.relatedReportNumber || null,

          status: upload.status || "—",

          statusDisplay: getStatusDisplay(upload.status),

          uploadedByName:
            upload.uploaded_by_name ||
            upload.uploadedByName ||
            upload.uploaded_by ||
            "—",

          date: upload.uploaded_at_utc || upload.date || null,

          /*
                Use report number first so the backend can resolve
                the stored filename and Blob.
              */
          downloadKey:
            upload.download_key ||
            reportNumber ||
            upload.upload_id ||
            upload.blob_name ||
            upload.storage_name ||
            upload.file_path ||
            filename,
        };
      }),
    [uploads],
  );

  /* ====================================================================
     Sorting
  ==================================================================== */

  const sortedUploads = useMemo(() => {
    return [...normalizedUploads].sort((a, b) => {
      let valueA = a[sortField];

      let valueB = b[sortField];

      if (sortField === "date") {
        valueA = valueA ? new Date(valueA).getTime() : 0;

        valueB = valueB ? new Date(valueB).getTime() : 0;
      } else if (sortField === "reportNumber") {
        valueA = Number(valueA) || 0;

        valueB = Number(valueB) || 0;
      } else {
        valueA = String(valueA || "").toLowerCase();

        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) {
        return sortOrder === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortOrder === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [normalizedUploads, sortField, sortOrder]);

  /* ====================================================================
     Pagination
  ==================================================================== */

  const totalPages = Math.max(1, Math.ceil(sortedUploads.length / pageSize));

  /*
    Return to the final valid page when the number of records changes.
  */
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;

  const paginatedUploads = sortedUploads.slice(
    startIndex,
    startIndex + pageSize,
  );

  /* ====================================================================
     Sort handler
  ==================================================================== */

  const changeSort = (field) => {
    if (sortField === field) {
      setSortOrder((currentOrder) => (currentOrder === "asc" ? "desc" : "asc"));

      return;
    }

    setSortField(field);
    setSortOrder("asc");
  };

  const sortIndicator = (field) => {
    if (sortField !== field) {
      return "";
    }

    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  /* ====================================================================
     Download
  ==================================================================== */

  const handleDownload = async (downloadKey, displayName) => {
    if (!downloadKey || downloadKey === "—") {
      return;
    }

    setDownloadingKey(String(downloadKey));

    try {
      const numericId = /^\d+$/.test(String(downloadKey));

      const url = numericId
        ? apiUrl(`/uploads/download/${downloadKey}`)
        : apiUrl(`/uploads/download/${encodeURIComponent(downloadKey)}`);

      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.status === 404) {
        alert(
          "File not found in storage. The upload record exists, but the file may have been moved or deleted.",
        );

        return;
      }

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();

      const contentDisposition = response.headers.get("content-disposition");

      let fileName = displayName || "download";

      /*
        Use the filename returned by the backend when available.
      */
      const fileNameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);

      if (fileNameMatch?.[1]) {
        fileName = fileNameMatch[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = fileName;

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);

      alert("Failed to download the file. Please try again.");
    } finally {
      setDownloadingKey(null);
    }
  };

  /* ====================================================================
     UI
  ==================================================================== */

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white/90 shadow-md">
      {/* Header */}

      <div className="rounded-t-2xl border-b bg-gradient-to-r from-slate-50 to-transparent p-4">
        <h3 className="text-lg font-bold text-emerald-700">Recent Uploads</h3>

        <p className="mt-1 text-xs text-slate-500">
          Most recent reports, accruals, returns, and Zero Sales declarations.
        </p>
      </div>

      {/* Table */}

      <div className="flex-1 overflow-auto p-4">
        <table className="min-w-[1050px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("reportNumber")}
              >
                Report #{sortIndicator("reportNumber")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("name")}
              >
                File
                {sortIndicator("name")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("reportType")}
              >
                Type
                {sortIndicator("reportType")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("periodDisplay")}
              >
                Period(s)
                {sortIndicator("periodDisplay")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("supplier")}
              >
                Supplier
                {sortIndicator("supplier")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("contract")}
              >
                Contract
                {sortIndicator("contract")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("statusDisplay")}
              >
                Status
                {sortIndicator("statusDisplay")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("uploadedByName")}
              >
                Uploaded By
                {sortIndicator("uploadedByName")}
              </th>

              <th
                className="cursor-pointer border px-3 py-2 hover:bg-slate-200"
                onClick={() => changeSort("date")}
              >
                Date
                {sortIndicator("date")}
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedUploads.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-6 text-center text-slate-500">
                  No uploads yet
                </td>
              </tr>
            ) : (
              paginatedUploads.map((upload) => {
                const isDownloading =
                  downloadingKey === String(upload.downloadKey);

                return (
                  <tr key={upload.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap border px-3 py-2">
                      {upload.reportNumber || "—"}
                    </td>

                    <td className="max-w-[260px] border px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleDownload(upload.downloadKey, upload.name)
                        }
                        disabled={isDownloading}
                        className="block max-w-full truncate text-left text-indigo-600 hover:underline disabled:cursor-wait disabled:opacity-60"
                        title={upload.name}
                      >
                        {isDownloading ? "Downloading..." : upload.name}
                      </button>
                    </td>

                    <td className="whitespace-nowrap border px-3 py-2">
                      {upload.reportType}

                      {upload.relatedReportNumber && (
                        <div className="mt-1 text-xs text-slate-500">
                          Related: #{upload.relatedReportNumber}
                        </div>
                      )}
                    </td>

                    <td className="border px-3 py-2">
                      {upload.periods.length > 0 ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {upload.periods.map((period) => (
                            <span
                              key={period}
                              className="whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                            >
                              {period}
                            </span>
                          ))}
                        </div>
                      ) : (
                        getPeriodDisplay(upload)
                      )}
                    </td>

                    <td className="whitespace-nowrap border px-3 py-2">
                      {upload.supplier}
                    </td>

                    <td className="whitespace-nowrap border px-3 py-2">
                      {upload.contract}
                    </td>

                    <td className="whitespace-nowrap border px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                          upload.status,
                        )}`}
                      >
                        {upload.statusDisplay}
                      </span>
                    </td>

                    <td className="border px-3 py-2">
                      {upload.uploadedByName}
                    </td>

                    <td className="whitespace-nowrap border px-3 py-2">
                      {upload.date
                        ? new Date(upload.date).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t bg-slate-50 px-4 py-3 text-sm">
        <div>
          Page {page} of {totalPages}
        </div>

        <div className="text-slate-500">
          {sortedUploads.length === 0
            ? "0 records"
            : `${startIndex + 1}-${Math.min(
                startIndex + pageSize,
                sortedUploads.length,
              )} of ${sortedUploads.length} records`}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPage((currentPage) => Math.max(1, currentPage - 1))
            }
            disabled={page === 1}
            className="rounded border px-3 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>

          <button
            type="button"
            onClick={() =>
              setPage((currentPage) => Math.min(totalPages, currentPage + 1))
            }
            disabled={page === totalPages}
            className="rounded border px-3 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));

            setPage(1);
          }}
          className="rounded border bg-white px-2 py-1"
        >
          {[5, 10, 20].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
