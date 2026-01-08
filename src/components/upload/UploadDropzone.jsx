import React, { useRef, useState } from "react";
import { FileSpreadsheet, CloudUpload, Download } from "lucide-react";
import Button from "../ui/Button";

const ACCEPT = [".xlsx", ".xls", ".csv"];

export default function UploadDropzone({ disabled, onFiles }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const TEMPLATE_BASE = import.meta.env.VITE_TEMPLATE_BASE_URL || "/templates";

  return (
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

        <p className="text-sm text-slate-500">Drop files here, or</p>

        <div className="flex gap-3">
          <Button onClick={() => inputRef.current?.click()} disabled={disabled}>
            <CloudUpload className="mr-2 h-4 w-4" />
            Browse…
          </Button>

          <a
            href={`${TEMPLATE_BASE}/member-template.xlsx`}
            download
            className="text-sm underline flex items-center gap-1 text-indigo-700 hover:text-indigo-800"
            title="Download Excel template"
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
  );
}
