// src/pages/faculty.jsx
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
import { useToast } from "../hooks/useToast.jsx";

// ---------- Constants ----------
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PHOTO = "/images/ANK.png";
const MODAL_HEADER_LOGO = "/images/Ank_Logo.png";
const UPLOAD_MAX_KB = 200;

// ---------- Main Component ----------
export default function FacultyPage() {
  const toast = useToast();

  // Lookup data
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // Table refresh
  const [tableKey, setTableKey] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getDefaultForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // File upload
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const isSelectingFileRef = useRef(false);
  const fileInputRef = useRef(null);
  const importRef = useRef(null);

  // ------- Init -------
  useEffect(() => {
    loadMasters();
    const onFocus = () => {
      setIsSelectingFile(false);
      isSelectingFileRef.current = false;
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Respond to state change to reset district
  useEffect(() => {
    if (!stateId) return;
    const valid = districts.filter((d) => String(d.state_id) === String(stateId));
    if (!valid.some((d) => String(d.district_id) === String(districtId))) {
      setDistrictId("");
    }
  }, [stateId, districts]);

  function getDefaultForm() {
    return {
      full_name: "",
      contact: "",
      email: "",
      address: "",
      dob: "",
      state_id: "",
      district_id: "",
      role_id: "",
      designation_id: "",
      department_id: "",
      image: "",
      create_user: false,
      username: "",
      user_email: "",
      sync_user_role: false,
    };
  }

  // ------- Load lookup data -------
  async function loadMasters() {
    try {
      const [sRes, rRes, dsgRes, deptRes, dRes] = await Promise.all([
        api.get("/api/master/states"),
        api.get("/api/master/roles"),
        api.get("/api/master/designations"),
        api.get("/api/master/departments"),
        api.get("/api/master/districts"),
      ]);
      setStates(sRes?.data || []);
      setRoles(rRes?.data || []);
      setDesignations(dsgRes?.data || []);
      setDepartments(deptRes?.data || []);
      setDistricts(dRes?.data || []);
    } catch (err) {
      console.error("Failed to load masters", err);
      toast.error("Failed to load dropdown data");
    }
  }

  // ------- Modal helpers -------
  function openCreate() {
    setEditing(null);
    setForm(getDefaultForm());
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      full_name: row.full_name || "",
      contact: row.contact || "",
      email: row.email || "",
      address: row.address || "",
      dob: row.dob ? String(row.dob).slice(0, 10) : "",
      state_id: row.state_id || "",
      district_id: row.district_id || "",
      role_id: row.role_id || "",
      designation_id: row.designation_id || "",
      department_id: row.department_id || "",
      image: row.image || "",
      create_user: !!(row.username || row.user_email),
      username: row.username || "",
      user_email: row.user_email || "",
      sync_user_role: false,
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (isSelectingFileRef.current) return;
    setModalOpen(false);
    setEditing(null);
  }

  // ------- File upload -------
  function triggerFileInput() {
    isSelectingFileRef.current = true;
    setIsSelectingFile(true);
    fileInputRef.current?.click();
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) {
      isSelectingFileRef.current = false;
      setIsSelectingFile(false);
      return;
    }

    if (file.size > UPLOAD_MAX_KB * 1024) {
      toast.error(`Photo must be under ${UPLOAD_MAX_KB}KB`);
      isSelectingFileRef.current = false;
      setIsSelectingFile(false);
      return;
    }

    // local preview
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result }));
    reader.readAsDataURL(file);

    await uploadPhoto(file);
  }

  async function uploadPhoto(file) {
    const fd = new FormData();
    fd.append("photo", file);
    const paths = ["/api/employees/upload-photo", "/api/employees/photo/upload"];
    for (const url of paths) {
      try {
        const res = await api.post(url, fd, { headers: {} });
        const imgUrl = res?.data?.url || res?.data?.data?.url || res?.url || "";
        if (imgUrl) {
          setForm((f) => ({ ...f, image: imgUrl }));
          toast.success("Photo uploaded");
          isSelectingFileRef.current = false;
          setIsSelectingFile(false);
          return;
        }
      } catch (err) {
        if (err?.status === 404) continue;
        else {
          toast.error(err?.response?.data?.message || "Upload failed");
          break;
        }
      }
    }
    isSelectingFileRef.current = false;
    setIsSelectingFile(false);
  }

  // ------- Form handlers -------
  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setErrors({});

    const newErrors = {};
    if (!form.full_name?.trim()) newErrors.full_name = "Name is required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Valid email required";
    if (form.contact && !/^[\d+\-\s()]{6,20}$/.test(form.contact)) newErrors.contact = "Enter a valid phone";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      contact: form.contact || null,
      email: form.email || null,
      address: form.address || null,
      dob: form.dob || null,
      state_id: form.state_id || null,
      district_id: form.district_id || null,
      role_id: form.role_id || null,
      designation_id: form.designation_id || null,
      department_id: form.department_id || null,
      image: form.image || null,
      create_user: form.create_user,
      username: form.username || undefined,
      user_email: form.user_email || undefined,
      sync_user_role: form.sync_user_role,
    };

    try {
      if (editing?.employee_id) {
        await api.put(`/api/employees/${editing.employee_id}`, payload);
        toast.success("Employee updated");
      } else {
        await api.post("/api/employees", payload);
        toast.success("Employee created");
      }
      setTableKey((k) => k + 1);
      closeModal();
    } catch (err) {
      console.error("Save error", err);
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      setErrors((e) => ({ ...e, form: msg }));
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ------- Delete -------
  async function handleDelete(id) {
    if (!window.confirm("Delete this faculty member?")) return;
    try {
      await api.delete(`/api/employees/${id}`);
      toast.success("Deleted");
      setTableKey((k) => k + 1);
    } catch (err) {
      console.error("Delete error", err);
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  }

  // ------- Import/Export -------
  async function handleImport(files) {
    const file = files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/api/employees/import-csv", fd);
      toast.success("Import started");
      setTableKey((k) => k + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Import failed");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function exportCsv() {
    try {
      await api.download("/api/employees/export/csv", { filename: "employees.csv" });
    } catch (err) {
      toast.error("Export failed");
    }
  }

  async function exportXlsx() {
    try {
      await api.download("/api/employees/export/excel", { filename: "employees.xlsx" });
    } catch (err) {
      toast.error("Export failed");
    }
  }

  // ------- Table columns & fetch -------
  const columns = [
    {
      Header: "Photo",
      accessor: "image",
      Cell: (r) => (
        <img
          src={r.image || DEFAULT_PHOTO}
          alt={r.full_name}
          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
          onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)}
        />
      ),
    },
    {
      Header: "Name",
      accessor: "full_name",
      Cell: (r) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{r.full_name}</div>
          {r.username && (
            <div className="text-sm text-slate-500 dark:text-slate-400">{r.username}</div>
          )}
        </div>
      ),
    },
    { Header: "Contact", accessor: "contact" },
    { Header: "Email", accessor: "email" },
    { Header: "Role", accessor: "role_name" },
    { Header: "Designation", accessor: "designation_name" },
    { Header: "Dept", accessor: "department_name" },
    {
      Header: "Location",
      accessor: "location",
      Cell: (r) => (
        <span className="text-sm">
          {r.state_name || "—"} / {r.district_name || "—"}
        </span>
      ),
    },
    {
      Header: "Actions",
      accessor: "actions",
      Cell: (r) => (
        <div className="flex gap-1">
          <IconBtn icon={ERPIcons.Edit} label="Edit" size="sm" onClick={() => openEdit(r)} />
          <IconBtn
            icon={ERPIcons.Delete}
            label="Delete"
            size="sm"
            onClick={() => handleDelete(r.employee_id)}
            className="hover:bg-rose-50 dark:hover:bg-rose-900/20"
          />
        </div>
      ),
    },
  ];

  const onFetch = useCallback(
    async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, sortDir }) => {
      const params = {
        page,
        pageSize,
        search: search || undefined,
        state_id: stateId || undefined,
        district_id: districtId || undefined,
        role_id: roleId || undefined,
        designation_id: designationId || undefined,
        department_id: departmentId || undefined,
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
      };
      try {
        const res = await api.get("/api/employees", { params });
        const rows = res?.data || [];
        const total = res?.pagination?.total || rows.length || 0;
        return { data: rows, total };
      } catch (err) {
        console.error("Fetch employees error", err);
        return { data: [], total: 0 };
      }
    },
    [search, stateId, districtId, roleId, designationId, departmentId]
  );

  // -------- Render --------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Faculty & Staff
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage employees and linked user accounts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <OutlineBtn>Import CSV</OutlineBtn>
                <input
                  ref={importRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files)}
                />
              </label>
              <OutlineBtn onClick={exportCsv}>Export CSV</OutlineBtn>
              <OutlineBtn onClick={exportXlsx}>Export Excel</OutlineBtn>
              <PrimaryBtn onClick={openCreate} leftIcon={ERPIcons.Plus}>
                Add Faculty
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search name, email, username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <ERPIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <SecondaryBtn onClick={() => setTableKey((k) => k + 1)}>Search</SecondaryBtn>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <FormField label="State">
              <Select
                value={stateId}
                onChange={(v) => setStateId(v)}
                options={[
                  { value: "", label: "All States" },
                  ...states.map((s) => ({ value: s.state_id, label: s.state_name })),
                ]}
              />
            </FormField>
            <FormField label="District">
              <Select
                value={districtId}
                onChange={(v) => setDistrictId(v)}
                options={[
                  { value: "", label: "All Districts" },
                  ...districts
                    .filter((d) => !stateId || String(d.state_id) === String(stateId))
                    .map((d) => ({ value: d.district_id, label: d.district_name })),
                ]}
              />
            </FormField>
            <FormField label="Role">
              <Select
                value={roleId}
                onChange={(v) => setRoleId(v)}
                options={[
                  { value: "", label: "All Roles" },
                  ...roles.map((r) => ({ value: r.role_id, label: r.role_name })),
                ]}
              />
            </FormField>
            <FormField label="Designation">
              <Select
                value={designationId}
                onChange={(v) => setDesignationId(v)}
                options={[
                  { value: "", label: "All Designations" },
                  ...designations.map((d) => ({ value: d.designation_id, label: d.designation_name })),
                ]}
              />
            </FormField>
            <FormField label="Department">
              <Select
                value={departmentId}
                onChange={(v) => setDepartmentId(v)}
                options={[
                  { value: "", label: "All Departments" },
                  ...departments.map((d) => ({ value: d.department_id, label: d.department_name })),
                ]}
              />
            </FormField>
            <div className="flex items-end gap-2">
              <PrimaryBtn size="sm" onClick={() => setTableKey((k) => k + 1)}>
                Apply
              </PrimaryBtn>
              <OutlineBtn
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStateId("");
                  setDistrictId("");
                  setRoleId("");
                  setDesignationId("");
                  setDepartmentId("");
                  setTableKey((k) => k + 1);
                }}
              >
                Clear
              </OutlineBtn>
            </div>
          </div>
        </div>

        {/* Table */}
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={closeModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-slate-800 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden flex flex-col"
                role="dialog"
                aria-modal="true"
              >
                {/* Modal header */}
                <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                  <img
                    src={MODAL_HEADER_LOGO}
                    alt="Logo"
                    className="h-10 sm:h-12 w-auto rounded"
                  />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                      {editing ? `Edit Faculty` : "Add Faculty"}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Fill in employee details and optional user account
                    </p>
                  </div>
                  <IconBtn
                    icon={ERPIcons.Close}
                    onClick={closeModal}
                    className="ml-auto"
                  />
                </div>

                {/* Scrollable form */}
                <form
                  onSubmit={handleSave}
                  className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
                >
                  {errors.form && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                      {errors.form}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Full Name *" required error={errors.full_name}>
                      <TextInput
                        value={form.full_name}
                        onChange={(v) => updateField("full_name", v)}
                        placeholder="Full name"
                      />
                    </FormField>
                    <FormField label="Contact" error={errors.contact}>
                      <TextInput
                        value={form.contact}
                        onChange={(v) => updateField("contact", v)}
                      />
                    </FormField>
                    <FormField label="Email" error={errors.email}>
                      <TextInput
                        value={form.email}
                        onChange={(v) => updateField("email", v)}
                        placeholder="email@company.com"
                      />
                    </FormField>
                    <FormField label="DOB">
                      <TextInput
                        type="date"
                        value={form.dob}
                        onChange={(v) => updateField("dob", v)}
                      />
                    </FormField>
                    <FormField label="State">
                      <Select
                        value={form.state_id}
                        onChange={(v) => {
                          updateField("state_id", v);
                          updateField("district_id", "");
                        }}
                        options={[
                          { value: "", label: "Select state" },
                          ...states.map((s) => ({
                            value: s.state_id,
                            label: s.state_name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="District">
                      <Select
                        value={form.district_id}
                        onChange={(v) => updateField("district_id", v)}
                        options={[
                          { value: "", label: "Select district" },
                          ...districts
                            .filter(
                              (d) =>
                                !form.state_id ||
                                String(d.state_id) === String(form.state_id)
                            )
                            .map((d) => ({
                              value: d.district_id,
                              label: d.district_name,
                            })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Role">
                      <Select
                        value={form.role_id}
                        onChange={(v) => updateField("role_id", v)}
                        options={[
                          { value: "", label: "Select role" },
                          ...roles.map((r) => ({
                            value: r.role_id,
                            label: r.role_name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Designation">
                      <Select
                        value={form.designation_id}
                        onChange={(v) => updateField("designation_id", v)}
                        options={[
                          { value: "", label: "Select designation" },
                          ...designations.map((d) => ({
                            value: d.designation_id,
                            label: d.designation_name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Department">
                      <Select
                        value={form.department_id}
                        onChange={(v) => updateField("department_id", v)}
                        options={[
                          { value: "", label: "Select department" },
                          ...departments.map((d) => ({
                            value: d.department_id,
                            label: d.department_name,
                          })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Address" className="sm:col-span-2">
                      <textarea
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white min-h-[80px] resize-y"
                      />
                    </FormField>
                  </div>

                  {/* Photo upload */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="h-24 w-24 bg-white dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0">
                      <img
                        src={form.image || DEFAULT_PHOTO}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)}
                      />
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => {
                          isSelectingFileRef.current = true;
                          setIsSelectingFile(true);
                        }}
                        onChange={(e) => {
                          onFileSelected(e);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <PrimaryBtn
                          size="sm"
                          onClick={triggerFileInput}
                          disabled={isSelectingFile}
                        >
                          Upload Photo
                        </PrimaryBtn>
                        {form.image && (
                          <button
                            type="button"
                            onClick={() => updateField("image", "")}
                            className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Max {UPLOAD_MAX_KB}KB – JPG/PNG recommended
                      </p>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* User creation */}
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      checked={form.create_user}
                      onChange={(v) => updateField("create_user", v)}
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Create linked user account
                    </span>
                  </div>

                  {form.create_user && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Username">
                        <TextInput
                          value={form.username}
                          onChange={(v) => updateField("username", v)}
                        />
                      </FormField>
                      <FormField label="User Email">
                        <TextInput
                          value={form.user_email}
                          onChange={(v) => updateField("user_email", v)}
                        />
                      </FormField>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.sync_user_role}
                          onChange={(e) => updateField("sync_user_role", e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <label className="text-sm text-slate-600 dark:text-slate-300">
                          Sync user role with employee role
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <OutlineBtn onClick={closeModal} disabled={saving}>
                      Cancel
                    </OutlineBtn>
                    <PrimaryBtn type="submit" loading={saving}>
                      {editing ? "Update Faculty" : "Add Faculty"}
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