import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

const emptyRow = () => ({
  customer_id: "",
  member_number: "",
  member_name: "",
  purchase_dollars_calc: "",
  caf: "",
  caf_dollars: "",
  dq_status: "passed",
  dq_messages: "",
});

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
    [form.report_type]
  );

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setError("");

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // Clear optional link when switching back to Accrual
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

      // optional helper: auto-calc CAF dollars when purchase/caf changes
      const purchase = Number(next[index].purchase_dollars_calc || 0);
      const cafRate = Number(next[index].caf || 0);

      if (
        field === "purchase_dollars_calc" ||
        field === "caf"
      ) {
        const calc = Math.round(purchase * cafRate * 100) / 100;
        next[index].caf_dollars =
          Number.isFinite(calc) && purchase && cafRate ? String(calc) : next[index].caf_dollars;
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
      return "Linked Accrual Report # must be a number.";
    }

    if (!rows.length) return "At least one row is required.";

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNo = i + 1;

      if (!row.member_name.trim()) {
        return `Row ${rowNo}: Member Name is required.`;
      }

      if (
        row.purchase_dollars_calc === "" ||
        Number.isNaN(Number(row.purchase_dollars_calc))
      ) {
        return `Row ${rowNo}: Purchase Amount must be a valid number.`;
      }

      if (row.caf === "" || Number.isNaN(Number(row.caf))) {
        return `Row ${rowNo}: CAF % must be a valid number.`;
      }

      if (row.caf_dollars === "" || Number.isNaN(Number(row.caf_dollars))) {
        return `Row ${rowNo}: CAF Dollars must be a valid number.`;
      }
    }

    return "";
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
      note: form.note.trim(),
      rows: rows.map((row) => ({
        customer_id: row.customer_id.trim() || null,
        member_number: row.member_number.trim() || null,
        member_name: row.member_name.trim(),
        purchase_dollars_calc: Number(row.purchase_dollars_calc),
        caf: Number(row.caf),
        caf_dollars: Number(row.caf_dollars),
        dq_status: row.dq_status || "passed",
        dq_messages: row.dq_messages.trim() || null,
      })),
    };

    try {
      setSaving(true);

      await apiFetch(apiUrl("/reports/manual-create"), {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert(`${form.report_type} report created successfully.`);
      navigate("/reports");
    } catch (err) {
      console.error("❌ Manual report create failed:", err);
      setError(err.message || "Failed to create manual report.");
    } finally {
      setSaving(false);
    }
  };

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

            <div className={form.report_type === "Return" ? "" : "md:col-span-2"}>
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

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border px-3 py-2">Customer ID</th>
                  <th className="border px-3 py-2">Member #</th>
                  <th className="border px-3 py-2">Member Name</th>
                  <th className="border px-3 py-2">Purchase Amount</th>
                  <th className="border px-3 py-2">CAF %</th>
                  <th className="border px-3 py-2">CAF Dollars</th>
                  <th className="border px-3 py-2">DQ Status</th>
                  <th className="border px-3 py-2">DQ Message</th>
                  <th className="border px-3 py-2">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="border px-2 py-2">
                      <input
                        value={row.customer_id}
                        onChange={(e) =>
                          handleRowChange(index, "customer_id", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        value={row.member_number}
                        onChange={(e) =>
                          handleRowChange(index, "member_number", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        value={row.member_name}
                        onChange={(e) =>
                          handleRowChange(index, "member_name", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.purchase_dollars_calc}
                        onChange={(e) =>
                          handleRowChange(
                            index,
                            "purchase_dollars_calc",
                            e.target.value
                          )
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={row.caf}
                        onChange={(e) =>
                          handleRowChange(index, "caf", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.caf_dollars}
                        onChange={(e) =>
                          handleRowChange(index, "caf_dollars", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <select
                        value={row.dq_status}
                        onChange={(e) =>
                          handleRowChange(index, "dq_status", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="passed">Passed</option>
                        <option value="validated">Validated</option>
                        <option value="failed">Failed</option>
                        <option value="approved">Approved</option>
                      </select>
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        value={row.dq_messages}
                        onChange={(e) =>
                          handleRowChange(index, "dq_messages", e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>

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