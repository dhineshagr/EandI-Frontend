// src/pages/ManageUsers.jsx
// ======================================================================
// Manage Users (Updated to new centralized API architecture)
// ----------------------------------------------------------------------
// ✔ Removed hardcoded backend URLs
// ✔ Uses apiUrl() and apiFetch() everywhere
// ✔ Automatic MSAL token handling (via apiFetch)
// ✔ Preserved all original functionality
// ======================================================================

import React, { useEffect, useState, useRef } from "react";
import { apiFetch } from "../api/apiClient";
import { apiUrl } from "../api/config";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Validation errors
  const [errors, setErrors] = useState({});

  // Form refs
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Form state
  const [form, setForm] = useState({
    user_type: "bp",
    username: "",
    display_name: "",
    email: "",
    role: "Business Partner",
    password: "",
    bp_code: "",
    okta_id: "",
    is_active: true,
  });

  // Reset form
  const resetForm = () => {
    setForm({
      user_type: "bp",
      username: "",
      display_name: "",
      email: "",
      role: "Business Partner",
      password: "",
      bp_code: "",
      okta_id: "",
      is_active: true,
    });
    setEditingId(null);
    setErrors({});
  };

  const normalizeUser = (u) => ({
    user_type: u.user_type || "bp",
    username: u.username || "",
    display_name: u.display_name || "",
    email: u.email || "",
    role: u.role || "Business Partner",
    password: "",
    bp_code: u.bp_code || "",
    okta_id: u.okta_id || "",
    is_active: u.is_active ?? true,
  });

  // ======================================================================
  // FETCH USERS (Centralized API call)
  // ======================================================================
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(apiUrl("/users"));
      setUsers(data.users || []);
    } catch (err) {
      console.error("❌ fetchUsers error", err);
      setErrors({ general: "Failed to fetch users." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ======================================================================
  // FORM HANDLERS
  // ======================================================================
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const validateForm = () => {
    let newErrors = {};

    if (!form.username) newErrors.username = "Username is required";
    if (!form.email) newErrors.email = "Email is required";

    if (form.user_type === "bp" && !editingId && !form.password) {
      newErrors.password = "Password is required for Business Partner users";
    }

    setErrors(newErrors);

    if (newErrors.username) usernameRef.current?.focus();
    else if (newErrors.email) emailRef.current?.focus();
    else if (newErrors.password) passwordRef.current?.focus();

    return Object.keys(newErrors).length === 0;
  };

  // ======================================================================
  // CREATE OR UPDATE USER
  // ======================================================================
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const payload = { ...form };
      if (payload.user_type === "internal") delete payload.password;

      await apiFetch(
        editingId ? apiUrl(`/users/${editingId}`) : apiUrl("/users"),
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      resetForm();
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      console.error("❌ saveUser error", err);
      setErrors({
        general: err.message || "Failed to save user. Check server logs.",
      });
    }
  };

  // ======================================================================
  // DELETE USER
  // ======================================================================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete user?")) return;

    try {
      await apiFetch(apiUrl(`/users/${id}`), { method: "DELETE" });
      fetchUsers();
    } catch (err) {
      console.error("❌ deleteUser error", err);
    }
  };

  // ======================================================================
  // TOGGLE ACTIVE STATUS
  // ======================================================================
  const handleToggleStatus = async (id, newStatus) => {
    try {
      await apiFetch(apiUrl(`/users/${id}/status`), {
        method: "PUT",
        body: JSON.stringify({ is_active: newStatus }),
      });
      fetchUsers();
    } catch (err) {
      console.error("❌ toggleStatus error", err);
    }
  };

  // ======================================================================
  // FILTERING + SEARCH
  // ======================================================================
  const filteredUsers = users.filter((u) =>
    Object.values(u).some((val) =>
      String(val || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  // ======================================================================
  // SORTING
  // ======================================================================
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aVal = a[sortConfig.key] ?? "";
    const bVal = b[sortConfig.key] ?? "";

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // ======================================================================
  // PAGINATION
  // ======================================================================
  const totalPages = Math.ceil(sortedUsers.length / pageSize);

  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) =>
    sortConfig.key === key ? (
      <span className="text-xs">
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    ) : null;

  // ======================================================================
  // UI START
  // ======================================================================
  if (loading) return <div className="p-6">Loading users...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manage Users</h1>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded"
        >
          + Create User
        </button>
      </div>

      {/* SEARCH + PAGE SIZE */}
      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="border p-2 rounded w-1/3"
        />

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="border p-2 rounded"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* USERS TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-slate-100">
            <tr>
              {[
                { key: "user_id", label: "USER ID" },
                { key: "user_type", label: "USER TYPE" },
                { key: "username", label: "USERNAME" },
                { key: "display_name", label: "DISPLAY NAME" },
                { key: "email", label: "EMAIL" },
                { key: "bp_code", label: "BP CODE" },
                { key: "okta_id", label: "OKTA ID" },
                { key: "role", label: "ROLE" },
                { key: "is_active", label: "STATUS" },
                { key: "actions", label: "ACTIONS" },
              ].map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 border ${
                    col.key !== "actions" ? "cursor-pointer" : ""
                  }`}
                  onClick={() =>
                    col.key !== "actions" ? requestSort(col.key) : null
                  }
                >
                  {col.label} {col.key !== "actions" && renderSortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedUsers.map((u) => (
              <tr key={u.user_id} className="hover:bg-slate-50">
                <td className="border px-2">{u.user_id}</td>
                <td className="border px-2">{u.user_type}</td>
                <td className="border px-2">{u.username}</td>
                <td className="border px-2">{u.display_name}</td>
                <td className="border px-2">{u.email}</td>
                <td className="border px-2">{u.bp_code}</td>
                <td className="border px-2">{u.okta_id}</td>
                <td className="border px-2">{u.role}</td>
                <td className="border px-2">
                  {u.is_active ? (
                    <span className="text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-red-600 font-medium">Disabled</span>
                  )}
                </td>

                <td className="border px-2 flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(u.user_id);
                      setForm(normalizeUser(u));
                      setShowModal(true);
                    }}
                    className="text-indigo-600 underline"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(u.user_id)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>

                  <button
                    onClick={() => handleToggleStatus(u.user_id, !u.is_active)}
                    className="text-slate-600 underline"
                  >
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}

            {paginatedUsers.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center py-4 text-slate-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-gray-600">
          Page {currentPage} of {totalPages || 1}
        </p>

        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL */}
      {/* ================================================================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[500px] p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit User" : "Create User"}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {/* USER TYPE */}
              <select
                name="user_type"
                value={form.user_type}
                onChange={handleChange}
                className="border p-2 rounded"
              >
                <option value="internal">Internal (Okta)</option>
                <option value="bp">Business Partner</option>
              </select>

              {/* USERNAME */}
              <div>
                <input
                  ref={usernameRef}
                  name="username"
                  placeholder="Username"
                  value={form.username}
                  onChange={handleChange}
                  className={`border p-2 rounded w-full ${
                    errors.username ? "border-red-500" : ""
                  }`}
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">{errors.username}</p>
                )}
              </div>

              {/* DISPLAY NAME */}
              <input
                name="display_name"
                placeholder="Display Name"
                value={form.display_name}
                onChange={handleChange}
                className="border p-2 rounded"
              />

              {/* EMAIL */}
              <div>
                <input
                  ref={emailRef}
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                  className={`border p-2 rounded w-full ${
                    errors.email ? "border-red-500" : ""
                  }`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* BP CODE */}
              <input
                name="bp_code"
                placeholder="BP Code"
                value={form.bp_code}
                onChange={handleChange}
                className="border p-2 rounded"
              />

              {/* OKTA ID (Internal only) */}
              {form.user_type === "internal" && (
                <input
                  name="okta_id"
                  placeholder="Okta ID"
                  value={form.okta_id}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
              )}

              {/* PASSWORD (BP only) */}
              {form.user_type === "bp" && (
                <div>
                  <input
                    ref={passwordRef}
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    className={`border p-2 rounded w-full ${
                      errors.password ? "border-red-500" : ""
                    }`}
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>
              )}

              {/* ROLE */}
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="border p-2 rounded"
              >
                <option value="Accounting">Accounting</option>
                <option value="Admin">Admin</option>
                <option value="Business Partner">Business Partner</option>
              </select>
            </div>

            {/* POPUP ERROR */}
            {errors.general && (
              <p className="text-red-600 text-sm mt-2">{errors.general}</p>
            )}

            {/* BUTTONS */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded"
              >
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
