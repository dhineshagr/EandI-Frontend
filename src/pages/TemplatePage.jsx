import React from "react";
import { Download } from "lucide-react";

export default function TemplatePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="max-w-xl w-full bg-white shadow-lg rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          Template Files
        </h1>

        <p className="text-slate-600 mb-6">
          Download the latest Excel/CSV templates to ensure your data uploads
          are formatted correctly.
        </p>

        <div className="space-y-4">
          {/* Excel Template */}
          <a
            href="/templates/sample_template.xlsx"
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 
              text-white font-medium rounded-lg shadow hover:bg-emerald-700 transition"
          >
            <Download className="h-4 w-4" /> Download Excel Template
          </a>

          {/* CSV Template */}
          <a
            href="/templates/sample_template.csv"
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 
              text-white font-medium rounded-lg shadow hover:bg-blue-700 transition"
          >
            <Download className="h-4 w-4" /> Download CSV Template
          </a>
        </div>
      </div>
    </div>
  );
}
