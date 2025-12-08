import React from "react";
import { Cloud, Info } from "lucide-react";

export default function StatusHero({ disabled, maxSizeText }) {
  return (
    <div className="bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500 text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Excel Upload Dashboard</h1>
            <p className="text-white/90 text-sm md:text-base mt-1">
              Secure upload with Azure Entra ID → Azure Blob → Informatica pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${disabled ? "bg-amber-400/90" : "bg-emerald-400/90"}`}>
              <Cloud className="h-4 w-4" /> {disabled ? "Storage: Not Configured" : "Storage: Connected"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/20">
              <Info className="h-4 w-4" /> {maxSizeText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
