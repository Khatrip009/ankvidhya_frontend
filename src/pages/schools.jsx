// src/pages/schools.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { ServerDataTable } from "../components/table.jsx";
import {
  PrimaryBtn,
  SecondaryBtn,
  OutlineBtn,
  DangerBtn,
  IconBtn,
} from "../components/buttons.jsx";
import {
  FormField,
  TextInput,
  Select,
  ToggleSwitch,
} from "../components/input.jsx";
import ERPIcons from "../components/icons.jsx";
import { LoadingCard } from "../components/cards.jsx";

const DEFAULT_PAGE_SIZE = 25;
const UPLOAD_MAX_KB = 50;
const DEFAULT_LOGO = "/images/ANK.png";
const MODAL_HEADER_LOGO = "/images/Ank_Logo.png";

export default function SchoolsPage() {
  // ---------- Toast notification system (built-in, no external hook needed) ----------
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback(({ type, message }) => {
    // clear any existing timer
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ type, message });
    toastTimer.current = setTimeout(() => {
      setToastMsg(null);
      toastTimer.current = null;
    }, 4000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Data
  const [mediums, setMediums] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  // Table refresh
  const [tableKey, setTableKey] = useState(0);
  const [search, setSearch] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getDefaultForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // File upload
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const fileInputRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_LOGO);

  // Load lookup data
  useEffect(() => {
    fetchLookups();
    const onFocus = () => setIsSelectingFile(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    setLogoPreview(form.image || DEFAULT_LOGO);
  }, [form.image]);

  function getDefaultForm() {
    return {
      school_name: "",
      address: "",
      district_id: "",
      state_id: "",
      medium_id: "",
      contact_person: "",
      contact_no: "",
      email: "",
      image: "",
      user: {
        username: "",
        email: "",
        password: "",
        must_change_password: false,
        role_name: "school_admin",
      },
    };
  }

  async function fetchLookups() {
    try {
      const [mRes, sRes, dRes] = await Promise.all([
        api.get("/api/master/mediums"),
        api.get("/api/master", { params: { table: "states" } }),
        api.get("/api/master", { params: { table: "districts" } }),
      ]);
      setMediums(mRes?.data || []);
      setStates(sRes?.data || sRes || []);
      setDistricts(dRes?.data || dRes || []);
    } catch (err) {
      console.error("Lookup load failed", err);
      showToast({ type: "error", message: "Failed to load dropdown data" });
    }
  }

  // -------- Modal handlers --------
  function openCreate() {
    setEditing(null);
    setForm(getDefaultForm());
    setErrors({});
    setFormError("");
    setLogoPreview(DEFAULT_LOGO);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      school_name: row.school_name || "",
      address: row.address || "",
      district_id: row.district_id || "",
      state_id: row.state_id || "",
      medium_id: row.medium_id || "",
      contact_person: row.contact_person || "",
      contact_no: row.contact_no || "",
      email: row.email || "",
      image: row.image || "",
      user: {
        username: row.user_name || "",
        email: row.user_email || "",
        password: "",
        must_change_password: false,
        role_name: "school_admin",
      },
    });
    setErrors({});
    setFormError("");
    setLogoPreview(row.image || DEFAULT_LOGO);
    setModalOpen(true);
  }

  function closeModal() {
    if (isSelectingFile) return;
    setModalOpen(false);
    setEditing(null);
  }

  // -------- Logo upload --------
  function handleLogoTrigger() {
    setIsSelectingFile(true);
    fileInputRef.current?.click();
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setIsSelectingFile(false);
      return;
    }

    if (file.size > UPLOAD_MAX_KB * 1024) {
      showToast({ type: "error", message: `File size must be under ${UPLOAD_MAX_KB}KB` });
      setIsSelectingFile(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
    await uploadLogo(file);
  }

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append("logo", file);
    const urls = [
      "/api/schools/schools/upload-logo",
      "/api/schools/schools/school/upload-logo",
      "/api/schools/schools/schools/upload-logo",
    ];

    for (const url of urls) {
      try {
        const res = await api.post(url, fd, { headers: {} });
        const imageUrl = res?.data?.url || res?.data?.data?.url || res?.url || "";
        if (imageUrl) {
          setForm((f) => ({ ...f, image: imageUrl }));
          showToast({ type: "success", message: "Logo uploaded" });
          return;
        }
      } catch (err) {
        if (err?.status === 404) continue;
        else break;
      }
    }
    showToast({ type: "error", message: "Failed to upload logo – server endpoint not found" });
  }

  // -------- Save --------
  function handleInputChange(field, value, group = null) {
    if (group === "user") {
      setForm((f) => ({ ...f, user: { ...f.user, [field]: value } }));
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
    setErrors((e) => ({ ...e, [group ? `user.${field}` : field]: undefined }));
  }

  async function saveSchool(e) {
    e?.preventDefault?.();
    setSaving(true);
    setFormError("");
    setErrors({});

    const newErrors = {};
    if (!form.school_name?.trim()) newErrors.school_name = "School name is required";
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Valid email is required";
    if (form.contact_no && !/^[\d+\-\s()]{6,20}$/.test(form.contact_no))
      newErrors.contact_no = "Enter a valid phone number";
    if (form.user?.email && !/^\S+@\S+\.\S+$/.test(form.user.email))
      newErrors["user.email"] = "Valid user email required";
    if (form.user?.password && form.user.password.length > 0 && form.user.password.length < 8)
      newErrors["user.password"] = "Password must be at least 8 characters";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setSaving(false);
      return;
    }

    const payload = {
      school_name: form.school_name.trim(),
      address: form.address,
      district_id: form.district_id || null,
      state_id: form.state_id || null,
      medium_id: form.medium_id || null,
      contact_person: form.contact_person,
      contact_no: form.contact_no,
      email: form.email,
      image: form.image || null,
    };

    const userPayload = buildUserPayload();
    if (userPayload) payload.user = userPayload;

    try {
      if (editing?.school_id) {
        await api.put(`/api/schools/schools/${editing.school_id}`, payload);
        showToast({ type: "success", message: "School updated" });
      } else {
        await api.post("/api/schools/schools", payload);
        showToast({ type: "success", message: "School created" });
      }
      setTableKey((k) => k + 1);
      closeModal();
    } catch (err) {
      console.error("Save error", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to save school";
      setFormError(msg);
      if (err?.status === 409) showToast({ type: "error", message: "Username or email already exists" });
      else showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  function buildUserPayload() {
    const u = form.user || {};
    if ((u.username?.trim() || u.email?.trim() || u.password?.trim())) {
      return {
        username: u.username?.trim() || undefined,
        email: u.email?.trim() || undefined,
        password: u.password || undefined,
        must_change_password: !!u.must_change_password,
        role_name: u.role_name || "school_admin",
      };
    }
    return null;
  }

  // -------- Delete --------
  async function handleDelete(row) {
    if (!window.confirm(`Delete "${row.school_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/schools/schools/${row.school_id}`);
      showToast({ type: "success", message: "School deleted" });
      setTableKey((k) => k + 1);
    } catch (err) {
      console.error("Delete error", err);
      showToast({ type: "error", message: err?.response?.data?.message || "Failed to delete" });
    }
  }

  // -------- Export/Import --------
  async function exportCsv() {
    try {
      await api.download("/api/schools/schools/export/csv", { filename: "schools.csv" });
    } catch (err) {
      showToast({ type: "error", message: "Export failed" });
    }
  }
  async function exportXlsx() {
    try {
      await api.download("/api/schools/schools/export/xlsx", { filename: "schools.xlsx" });
    } catch (err) {
      showToast({ type: "error", message: "Export failed" });
    }
  }
  async function importCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/api/schools/schools/import", fd, { headers: {} });
      showToast({ type: "success", message: "Import successful" });
      setTableKey((k) => k + 1);
    } catch (err) {
      showToast({ type: "error", message: err?.response?.data?.message || "Import failed" });
    } finally {
      e.target.value = "";
    }
  }

  // -------- Server table fetch handler --------
  const onFetch = useCallback(
    async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, sortDir }) => {
      try {
        const params = { page, pageSize, search: search || undefined };
        if (sortBy) {
          params.sortBy = typeof sortBy === "string" ? sortBy : sortBy.accessor || sortBy;
          params.sortDir = sortDir || "asc";
        }
        const res = await api.get("/api/schools/schools", { params });
        const rows = res?.data || [];
        const total = res?.pagination?.total || res?.total || rows.length || 0;
        return { data: rows, total };
      } catch (err) {
        console.error("Server fetch error", err);
        return { data: [], total: 0 };
      }
    },
    [search]
  );

  // -------- Table columns --------
  const columns = [
    {
      Header: "Logo",
      accessor: "image",
      Cell: (r) => (
        <img
          src={r.image || DEFAULT_LOGO}
          alt={r.school_name}
          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
          onError={(e) => (e.currentTarget.src = DEFAULT_LOGO)}
        />
      ),
    },
    {
      Header: "School",
      accessor: "school_name",
      Cell: (r) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{r.school_name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{r.address}</div>
        </div>
      ),
    },
    {
      Header: "Contact",
      accessor: "contact_person",
      Cell: (r) => (
        <div>
          <div className="text-sm">{r.contact_person || "—"}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.contact_no || "—"}</div>
        </div>
      ),
    },
    { Header: "Email", accessor: "email" },
    { Header: "Medium", accessor: "medium_name" },
    {
      Header: "Created",
      accessor: "created_at",
      Cell: (r) =>
        r.created_at ? new Date(r.created_at).toLocaleDateString() : "—",
    },
    {
      Header: "Actions",
      accessor: "actions",
      Cell: (r) => (
        <div className="flex gap-1">
          <IconBtn
            icon={ERPIcons.Edit}
            label="Edit"
            size="sm"
            onClick={() => openEdit(r)}
          />
          <IconBtn
            icon={ERPIcons.Delete}
            label="Delete"
            size="sm"
            onClick={() => handleDelete(r)}
            className="hover:bg-rose-50 dark:hover:bg-rose-900/20"
          />
        </div>
      ),
    },
  ];

  // -------- Render --------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      {/* Toast message */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
              toastMsg.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200"
            }`}
            role="alert"
          >
            <span>{toastMsg.message}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="ml-2 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ERPIcons.Close className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Schools
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage registered schools & their admins
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryBtn onClick={openCreate} leftIcon={ERPIcons.Plus}>
                Add School
              </PrimaryBtn>
              <OutlineBtn onClick={exportCsv}>Export CSV</OutlineBtn>
              <OutlineBtn onClick={exportXlsx}>Export XLSX</OutlineBtn>
              <label className="cursor-pointer">
                <OutlineBtn>Import CSV</OutlineBtn>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={importCsv}
                />
              </label>
            </div>
          </div>
        </motion.div>

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name, email, username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500"
            />
            <ERPIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <SecondaryBtn onClick={() => setTableKey((k) => k + 1)}>Search</SecondaryBtn>
        </div>

        {/* Server‑driven table */}
        <div className="overflow-x-auto rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <ServerDataTable
            key={tableKey}
            columns={columns}
            onFetch={onFetch}
            initialPageSize={DEFAULT_PAGE_SIZE}
            selectable={false}
          />
        </div>

        {/* Modal */}
        <AnimatePresence>
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={isSelectingFile ? undefined : closeModal}
              />

              {/* Modal content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl flex flex-col bg-white dark:bg-slate-800 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
              >
                {/* Modal header */}
                <div className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                  <img
                    src={MODAL_HEADER_LOGO}
                    alt="Logo"
                    className="h-10 sm:h-12 w-auto rounded"
                  />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                      {editing ? `Edit: ${editing.school_name}` : "Create School"}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Fill school details and optional admin account
                    </p>
                  </div>
                  <IconBtn
                    icon={ERPIcons.Close}
                    onClick={closeModal}
                    className="ml-auto"
                  />
                </div>

                {/* Scrollable form */}
                <form onSubmit={saveSchool} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                  {formError && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="School Name *" required error={errors.school_name}>
                      <TextInput
                        value={form.school_name}
                        onChange={(v) => handleInputChange("school_name", v)}
                        placeholder="School name"
                      />
                    </FormField>
                    <FormField label="Email *" required error={errors.email}>
                      <TextInput
                        value={form.email}
                        onChange={(v) => handleInputChange("email", v)}
                        placeholder="school@example.com"
                      />
                    </FormField>
                    <FormField label="Contact Person" error={errors.contact_person}>
                      <TextInput
                        value={form.contact_person}
                        onChange={(v) => handleInputChange("contact_person", v)}
                      />
                    </FormField>
                    <FormField label="Contact No" error={errors.contact_no}>
                      <TextInput
                        value={form.contact_no}
                        onChange={(v) => handleInputChange("contact_no", v)}
                      />
                    </FormField>
                    <FormField label="State" error={errors.state_id}>
                      <Select
                        value={form.state_id || ""}
                        onChange={(v) => handleInputChange("state_id", v)}
                        options={[
                          { value: "", label: "Select State" },
                          ...states.map((s) => ({
                            value: s.state_id || s.id,
                            label: s.state_name || s.name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="District" error={errors.district_id}>
                      <Select
                        value={form.district_id || ""}
                        onChange={(v) => handleInputChange("district_id", v)}
                        options={[
                          { value: "", label: "Select District" },
                          ...districts.map((d) => ({
                            value: d.district_id || d.id,
                            label: d.district_name || d.name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Medium" error={errors.medium_id}>
                      <Select
                        value={form.medium_id || ""}
                        onChange={(v) => handleInputChange("medium_id", v)}
                        options={[
                          { value: "", label: "Select Medium" },
                          ...mediums.map((m) => ({
                            value: m.medium_id || m.id,
                            label: m.medium_name || m.name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Address" error={errors.address}>
                      <TextInput
                        value={form.address}
                        onChange={(v) => handleInputChange("address", v)}
                      />
                    </FormField>
                  </div>

                  {/* Logo upload */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="h-24 w-24 bg-white dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.src = DEFAULT_LOGO)}
                      />
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => setIsSelectingFile(true)}
                        onChange={(e) => {
                          onFileSelected(e);
                          setIsSelectingFile(false);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <PrimaryBtn
                          onClick={handleLogoTrigger}
                          disabled={isSelectingFile}
                          size="sm"
                        >
                          Upload Logo
                        </PrimaryBtn>
                        {form.image && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm((f) => ({ ...f, image: "" }));
                              setLogoPreview(DEFAULT_LOGO);
                            }}
                            className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Max {UPLOAD_MAX_KB}KB – PNG/JPG recommended
                      </p>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* User account section */}
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    Admin User Account (optional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Username" error={errors["user.username"]}>
                      <TextInput
                        value={form.user.username}
                        onChange={(v) => handleInputChange("username", v, "user")}
                      />
                    </FormField>
                    <FormField label="User Email" error={errors["user.email"]}>
                      <TextInput
                        value={form.user.email}
                        onChange={(v) => handleInputChange("email", v, "user")}
                      />
                    </FormField>
                    <FormField label="Password" error={errors["user.password"]}>
                      <TextInput
                        type="password"
                        value={form.user.password}
                        onChange={(v) => handleInputChange("password", v, "user")}
                      />
                    </FormField>
                    <div className="flex items-center gap-3 pt-6">
                      <ToggleSwitch
                        checked={!!form.user.must_change_password}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            user: { ...f.user, must_change_password: v },
                          }))
                        }
                      />
                      <label className="text-sm text-slate-600 dark:text-slate-300">
                        Force password change on first login
                      </label>
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <OutlineBtn onClick={closeModal} disabled={saving}>
                      Cancel
                    </OutlineBtn>
                    <PrimaryBtn type="submit" loading={saving}>
                      {editing ? "Update School" : "Create School"}
                    </PrimaryBtn>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}