import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

const REQUIRED_FIELDS = [
  { key: "customer_id", label: "Customer ID", type: "text" },
  { key: "member_number", label: "Member #", type: "text" },
  { key: "member_name", label: "Member Name", type: "text" },
  { key: "member_address", label: "Member Address", type: "text" },
  { key: "member_city", label: "Member City", type: "text" },
  { key: "member_state", label: "Member State", type: "text" },
  { key: "member_zip", label: "Member Zip", type: "text" },
  { key: "ship_to", label: "Ship To", type: "text" },
  { key: "ship_to_address", label: "Ship To Address", type: "text" },
  { key: "ship_to_city", label: "Ship To City", type: "text" },
  { key: "ship_to_state", label: "Ship To State", type: "text" },
  { key: "ship_to_zip", label: "Ship To Zip", type: "text" },
  {
    key: "purchase_dollars",
    label: "Purchase Dollars",
    type: "number",
    step: "0.01",
  },
  { key: "caf", label: "CAF %", type: "number", step: "0.0001" },
  { key: "caf_dollars", label: "CAF Dollars", type: "number", step: "0.01" },
];

const OPTIONAL_FIELDS = [
  { key: "po", label: "PO", type: "text" },
  { key: "invoice", label: "Invoice", type: "text" },
  { key: "invoice_date", label: "Invoice Date", type: "date" },
  { key: "item", label: "Item", type: "text" },
  { key: "manufacturer", label: "Manufacturer", type: "text" },
  { key: "manufacturer_part", label: "Manufacturer Part", type: "text" },
  { key: "um", label: "UM", type: "text" },
  { key: "desc", label: "Description", type: "text" },
  { key: "unspsc", label: "UNSPSC", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "subcategory", label: "SubCategory", type: "text" },
  { key: "retail_price", label: "Retail Price", type: "number", step: "0.01" },
  {
    key: "contract_price",
    label: "Contract Price",
    type: "number",
    step: "0.01",
  },
  { key: "qty", label: "Qty", type: "number", step: "0.01" },
];

const FIELD_DEFS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const emptyRow = () => ({
  customer_id: "",
  member_number: "",
  member_name: "",
  member_address: "",
  member_city: "",
  member_state: "",
  member_zip: "",
  ship_to: "",
  ship_to_address: "",
  ship_to_city: "",
  ship_to_state: "",
  ship_to_zip: "",
  purchase_dollars: "",
  caf: "",
  caf_dollars: "",
  po: "",
  invoice: "",
  invoice_date: "",
  item: "",
  manufacturer: "",
  manufacturer_part: "",
  um: "",
  desc: "",
  unspsc: "",
  category: "",
  subcategory: "",
  retail_price: "",
  contract_price: "",
  qty: "",
});

const numberFields = new Set([
  "purchase_dollars",
  "caf",
  "caf_dollars",
  "retail_price",
  "contract_price",
  "qty",
]);

export default function ManualReportCreate() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    report_type: "Accrual",
    period: "",
    bp_code: "",
    contract_id: "",
    related_report_number: "",
    note: "",
  });

  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(
    () =>
      form.report_type === "Return"
        ? "Create Manual Return"
        : "Create Manual Accrual",
    [form.report_type],
  );

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setError("");

    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "report_type" && value !== "Return") {
        next.related_report_number = "";
      }
      return next;
    });
  };

  const handleRowChange = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      if (field === "purchase_dollars" || field === "caf") {
        const purchase = Number(next[index].purchase_dollars || 0);
        const cafRate = Number(next[index].caf || 0);
         const calc = Math.round(purchase * (cafRate / 100) * 100) / 100;

        if (purchase && cafRate) {
          next[index].caf_dollars = String(calc);
        }
      }

      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const validate = () => {
    if (!form.period) return "Period is required.";
    if (!form.bp_code.trim()) return "Supplier Code is required.";

    if (
      form.report_type === "Return" &&
      form.related_report_number &&
      Number.isNaN(Number(form.related_report_number))
    ) {
      return "Linked Accrual Report # must be a valid number.";
    }

    if (!rows.length) return "At least one row is required.";

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNo = i + 1;

      for (const field of REQUIRED_FIELDS) {
        const value = row[field.key];
        if (value === "" || value === null || value === undefined) {
          return `Row ${rowNo}: ${field.label} is required.`;
        }
      }

      if (Number.isNaN(Number(row.purchase_dollars))) {
        return `Row ${rowNo}: Purchase Dollars must be a valid number.`;
      }

      if (Number.isNaN(Number(row.caf))) {
        return `Row ${rowNo}: CAF % must be a valid number.`;
      }

      if (Number.isNaN(Number(row.caf_dollars))) {
        return `Row ${rowNo}: CAF Dollars must be a valid number.`;
      }
    }

    return "";
  };

  const normalizeValue = (key, value) => {
    if (value === "" || value === undefined || value === null) return null;
    if (numberFields.has(key)) return Number(value);
    return String(value).trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      report_type: form.report_type,
      period: form.period,
      bp_code: form.bp_code.trim(),
      contract_id: form.contract_id.trim() || null,
      related_report_number:
        form.report_type === "Return" && form.related_report_number
          ? Number(form.related_report_number)
          : null,
      note: form.note.trim() || "",
      rows: rows.map((row) => {
        const out = {};
        for (const field of FIELD_DEFS) {
          out[field.key] = normalizeValue(field.key, row[field.key]);
        }
        return out;
      }),
    };

    try {
      setSaving(true);

      const result = await apiFetch(apiUrl("/reports/manual-create"), {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert(
        result?.message ||
          `${form.report_type} report created and submitted for validation.`,
      );
      navigate("/reports");
    } catch (err) {
      console.error("❌ Manual report create failed:", err);
      setError(err.message || "Failed to create manual report.");
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (row, index, field) => (
    <td key={field.key} className="border px-2 py-2">
      <input
        type={field.type}
        step={field.step}
        value={row[field.key]}
        onChange={(e) => handleRowChange(index, field.key, e.target.value)}
        className="w-full border rounded px-2 py-1"
      />
    </td>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
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
        <div className="bg-white shadow rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold">Report Header</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Report Type
              </label>
              <select
                name="report_type"
                value={form.report_type}
                onChange={handleHeaderChange}
                className="w-full border rounded px-3 py-2"
              >
                <option value="Accrual">Accrual</option>
                <option value="Return">Return</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Period</label>
              <input
                type="month"
                name="period"
                value={form.period}
                onChange={handleHeaderChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Supplier Code
              </label>
              <input
                type="text"
                name="bp_code"
                value={form.bp_code}
                onChange={handleHeaderChange}
                placeholder="Enter Supplier Code"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Contract ID
              </label>
              <input
                type="text"
                name="contract_id"
                value={form.contract_id}
                onChange={handleHeaderChange}
                placeholder="Enter Contract ID"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {form.report_type === "Return" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Linked Accrual Report # (Optional)
                </label>
                <input
                  type="number"
                  name="related_report_number"
                  value={form.related_report_number}
                  onChange={handleHeaderChange}
                  placeholder="Enter original Accrual report #"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            <div
              className={form.report_type === "Return" ? "" : "md:col-span-2"}
            >
              <label className="block text-sm font-medium mb-1">Note</label>
              <input
                type="text"
                name="note"
                value={form.note}
                onChange={handleHeaderChange}
                placeholder="Optional note"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manual Rows</h2>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          </div>

          <div>
            <h3 className="font-medium text-slate-700 mb-2">Required Fields</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {REQUIRED_FIELDS.map((field) => (
                      <th key={field.key} className="border px-3 py-2">
                        {field.label}
                      </th>
                    ))}
                    <th className="border px-3 py-2">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`required-${index}`}>
                      {REQUIRED_FIELDS.map((field) =>
                        renderCell(row, index, field),
                      )}

                      <td className="border px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-600 hover:underline"
                          disabled={rows.length === 1}
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-700 mb-2">
              Optional Reconciliation Fields
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {OPTIONAL_FIELDS.map((field) => (
                      <th key={field.key} className="border px-3 py-2">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`optional-${index}`}>
                      {OPTIONAL_FIELDS.map((field) =>
                        renderCell(row, index, field),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm font-medium">{error}</div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded text-white font-semibold ${
                saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {saving ? "Saving..." : `Create ${form.report_type}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
