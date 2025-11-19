// src/pages/faculty.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../lib/api";
import { ServerDataTable } from "../components/table.jsx";

import {
  CreateBtn,
  PrimaryBtn,
  SecondaryBtn,
  FileUploadBtn,
  SaveBtn,
  CancelBtn,
  DeleteBtn
} from "../components/buttons.jsx";

import {
  FormField,
  TextInput,
  TextArea,
  Select,
  FileInput,
  Checkbox,
  ToggleSwitch,
  DateInput
} from "../components/input.jsx";

/*
  Faculty (Employees) page — React + componentized
  Mirrors behavior from legacy employees.js but uses shared components and ERP theme
*/

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PHOTO = "/images/ANK.png";
const UPLOAD_MAX_BYTES = 200 * 1024; // 200 KB for faculty photos

const ENDPOINTS = {
  LIST: "/api/employees",
  ONE: (id) => `/api/employees/${id}`,
  IMPORT: "/api/employees/import-csv",
  EXPORT_CSV: "/api/employees/export/csv",
  EXPORT_XLSX: "/api/employees/export/excel",

  STATES: "/api/master/states",
  DISTRICTS: "/api/master/districts",
  ROLES: "/api/master/roles",
  DESIGNS: "/api/master/designations",
  DEPTS: "/api/master/departments"
};

export default function FacultyPage() {
  // table & filters
  const [tableKey, setTableKey] = useState(0);
  const [search, setSearch] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // data caches
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  // synchronous ref to avoid race between setState and immediate checks (backdrop click)
  const isSelectingFileRef = useRef(false);

  const hiddenFileRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => {
    loadMasters();
    // clear selecting on window focus (file dialog closed)
    const onFocus = () => {
      setIsSelectingFile(false);
      isSelectingFileRef.current = false;
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function defaultForm() {
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
      sync_user_role: false
    };
  }

  async function loadMasters() {
    try {
      const [s, r, dsg, dept] = await Promise.all([
        api.get(ENDPOINTS.STATES).then(r => r.data || []),
        api.get(ENDPOINTS.ROLES).then(r => r.data || []),
        api.get(ENDPOINTS.DESIGNS).then(r => r.data || []),
        api.get(ENDPOINTS.DEPTS).then(r => r.data || [])
      ]);
      setStates(s);
      setRoles(r);
      setDesignations(dsg);
      setDepartments(dept);

      // preload districts (all) — the master districts endpoint returns many; we keep local filter
      const allDistricts = await api.get(ENDPOINTS.DISTRICTS).then(r => r.data || []);
      setDistricts(allDistricts);
    } catch (err) {
      console.error("Failed to load masters", err);
      setStates([]); setRoles([]); setDesignations([]); setDepartments([]); setDistricts([]);
    }
  }

  /* --------------------
     Table columns + fetch
     -------------------- */
  const columns = [
    {
      Header: "Photo",
      accessor: "image",
      Cell: (r) => {
        const src = r.image ? r.image : DEFAULT_PHOTO;
        return (
          <div className="h-12 w-12 overflow-hidden flex items-center justify-center bg-white rounded-md">
            <img src={src} alt={r.full_name} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)} />
          </div>
        );
      }
    },
    { Header: "Name", accessor: "full_name", Cell: (r) => (<div><div className="text-lg font-medium">{r.full_name}</div><div className="text-sm text-gray-500">{r.username || ""}</div></div>) },
    { Header: "Contact", accessor: "contact" },
    { Header: "Email", accessor: "email" },
    { Header: "Role", accessor: "role_name" },
    { Header: "Designation", accessor: "designation_name" },
    { Header: "Dept", accessor: "department_name" },
    { Header: "Location", accessor: "location", Cell: (r) => (<div className="text-sm">{r.state_name || "-"} / {r.district_name || "-"}</div>) },
    {
      Header: "Actions",
      accessor: "actions",
      Cell: (r) => (
        <div className="flex gap-2">
          <PrimaryBtn size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</PrimaryBtn>
          <DeleteBtn size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(r.employee_id); }}>Delete</DeleteBtn>
        </div>
      )
    }
  ];

  const onFetch = useCallback(async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, sortDir }) => {
    const q = {
      page, pageSize,
      search: search || undefined,
      state_id: stateId || undefined,
      district_id: districtId || undefined,
      role_id: roleId || undefined,
      designation_id: designationId || undefined,
      department_id: departmentId || undefined
    };
    try {
      const res = await api.get(ENDPOINTS.LIST, { query: q });
      const rows = res.data || [];
      const total = (res.pagination && res.pagination.total) || (res.total ?? rows.length) || 0;
      return { data: rows, total };
    } catch (err) {
      console.error("fetch employees", err);
      return { data: [], total: 0 };
    }
  }, [search, stateId, districtId, roleId, designationId, departmentId]);

  /* --------------------
     Modal: open/edit/close
     -------------------- */
  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setErrors({});
    setModalOpen(true);
  }

  async function openEdit(rowOrId) {
    setErrors({});
    if (typeof rowOrId === "object" && rowOrId) {
      setEditing(rowOrId);
      setForm(mapEmployeeToForm(rowOrId));
      setModalOpen(true);
      return;
    }
    // fetch by id
    try {
      const res = await api.get(ENDPOINTS.ONE(rowOrId));
      const d = res?.data || null;
      if (d) {
        setEditing(d);
        setForm(mapEmployeeToForm(d));
        setModalOpen(true);
      }
    } catch (err) {
      console.error("load employee", err);
      window.ui?.toast?.("Failed to load employee", "danger");
    }
  }

  function closeModal() {
    // Use ref for immediate check
    if (isSelectingFileRef.current) return; // ignore close while file picker active
    setModalOpen(false);
    setEditing(null);
    setErrors({});
  }

  function mapEmployeeToForm(d) {
    return {
      full_name: d.full_name || "",
      contact: d.contact || "",
      email: d.email || "",
      address: d.address || "",
      dob: d.dob ? String(d.dob).substring(0, 10) : "",
      state_id: d.state_id || "",
      district_id: d.district_id || "",
      role_id: d.role_id || "",
      designation_id: d.designation_id || "",
      department_id: d.department_id || "",
      image: d.image || "",
      create_user: !!(d.username || d.user_email),
      username: d.username || "",
      user_email: d.user_email || d.email || "",
      sync_user_role: false
    };
  }

  /* --------------------
     File handling (photo upload)
     -------------------- */
  async function handlePhotoFiles(files) {
    // ensure ref/state set immediately
    isSelectingFileRef.current = true;
    setIsSelectingFile(true);

    const f = files && files[0];
    if (!f) {
      isSelectingFileRef.current = false;
      setIsSelectingFile(false);
      return;
    }
    if (f.size > UPLOAD_MAX_BYTES) {
      const msg = `Photo too large — max ${Math.round(UPLOAD_MAX_BYTES / 1024)}KB`;
      setErrors(e => ({ ...e, image: msg }));
      window.ui?.toast?.(msg, "danger");
      isSelectingFileRef.current = false;
      setIsSelectingFile(false);
      return;
    }

    // preview locally
    const reader = new FileReader();
    reader.onload = () => setForm(frm => ({ ...frm, image: reader.result }));
    reader.readAsDataURL(f);

    // upload to server (try common endpoints)
    const fd = new FormData();
    fd.append("photo", f);

    const paths = ["/api/employees/upload-photo", "/api/employees/photo/upload"];
    let lastErr = null;
    for (const p of paths) {
      try {
        const res = await api.post(p, fd, { headers: {} });
        const url = res?.url || (res?.data && res.data.url) || (typeof res === "string" ? res : undefined);
        if (url) {
          setForm(frm => ({ ...frm, image: url }));
          window.ui?.toast?.("Photo uploaded", "success");
          isSelectingFileRef.current = false;
          setIsSelectingFile(false);
          return;
        }
      } catch (err) {
        lastErr = err;
        const msg = err?.data?.message || err?.message || "";
        if (/Not Found/i.test(msg) || err?.status === 404) continue;
        setErrors(e => ({ ...e, image: err?.data?.message || err?.message || "Upload failed" }));
        window.ui?.toast?.(err?.data?.message || err?.message || "Upload failed", "danger");
        isSelectingFileRef.current = false;
        setIsSelectingFile(false);
        return;
      }
    }
    console.error("photo upload failed", lastErr);
    isSelectingFileRef.current = false;
    setIsSelectingFile(false);
  }

  /* --------------------
     Save (create/update) with validation
     -------------------- */
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setErrors({});
    try {
      // validation
      const newErrors = {};
      if (!form.full_name || !form.full_name.trim()) newErrors.full_name = "Name is required";
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Enter a valid email";
      if (form.contact && !/^[\d+\-\s()]{6,20}$/.test(form.contact)) newErrors.contact = "Enter a valid phone";

      if (Object.keys(newErrors).length) {
        setErrors(newErrors);
        setSaving(false);
        return;
      }

      // build payload; if image is dataURL we keep as-is so server can accept a base64 or previously uploaded URL
      const payload = {
        full_name: form.full_name,
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
        create_user: !!form.create_user,
        username: form.username || undefined,
        user_email: form.user_email || undefined,
        sync_user_role: !!form.sync_user_role
      };

      // If the image is a File object (we won't be passing File from component here but keep check for possible extension)
      // For simplicity: send JSON payload; adjust if your backend expects multipart for new photo.
      if (editing && editing.employee_id) {
        await api.put(ENDPOINTS.ONE(editing.employee_id), payload);
        window.ui?.toast?.("Employee updated", "success");
      } else {
        await api.post(ENDPOINTS.LIST, payload);
        window.ui?.toast?.("Employee created", "success");
      }

      // refresh table
      setTableKey(k => k + 1);
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      console.error("save employee", err);
      const msg = err?.data?.message || err?.message || "Save failed";
      setErrors(e => ({ ...e, form: msg }));
      window.ui?.toast?.(msg, "danger");
    } finally {
      setSaving(false);
      isSelectingFileRef.current = false;
      setIsSelectingFile(false);
    }
  }

  /* --------------------
     Delete
     -------------------- */
  async function handleDelete(id) {
    if (!window.confirm("Delete this staff member? This cannot be undone.")) return;
    try {
      await api.del(ENDPOINTS.ONE(id));
      window.ui?.toast?.("Deleted", "success");
      setTableKey(k => k + 1);
    } catch (err) {
      console.error("delete", err);
      window.ui?.toast?.(err?.data?.message || err?.message || "Delete failed", "danger");
    }
  }

  /* --------------------
     Import / export helpers
     -------------------- */
  async function handleImportFile(f) {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      await api.post(ENDPOINTS.IMPORT, fd);
      window.ui?.toast?.("Import started", "success");
      setTableKey(k => k + 1);
    } catch (err) {
      console.error("import", err);
      window.ui?.toast?.(err?.data?.message || err?.message || "Import failed", "danger");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function handleExportCsv() {
    try { await api.download(ENDPOINTS.EXPORT_CSV, { filename: "employees.csv" }); }
    catch (err) { window.ui?.toast?.(err?.message || "Export failed", "danger"); }
  }
  async function handleExportXlsx() {
    try { await api.download(ENDPOINTS.EXPORT_XLSX, { filename: "employees.xlsx" }); }
    catch (err) { window.ui?.toast?.(err?.message || "Export failed", "danger"); }
  }

  /* --------------------
     Derived filtered district options for selected state
     -------------------- */
  const filteredDistricts = districtListForState(districts, stateId);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Faculty</h1>
          <div className="text-sm text-slate-500 mt-1">Manage employees & linked users</div>
        </div>

        <div className="flex items-center gap-2">
          <FileUploadBtn onChange={(e) => handleImportFile(e.target.files && e.target.files[0])} accept=".csv,text/csv">Import CSV</FileUploadBtn>
          <SecondaryBtn onClick={handleExportCsv}>Export CSV</SecondaryBtn>
          <SecondaryBtn onClick={handleExportXlsx}>Export Excel</SecondaryBtn>
          <CreateBtn onClick={openCreate} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-sm text-slate-500">Search</label>
            <div className="mt-1">
              <TextInput placeholder="Search name / username / email" value={search} onChange={setSearch} clearable />
            </div>
          </div>

          <div>
            <FormField label="State">
              <Select value={stateId} onChange={(v) => setStateId(v)} options={[{value:"",label:"Any"}].concat(states.map(s => ({ value: s.state_id, label: s.state_name })))} />
            </FormField>
          </div>

          <div>
            <FormField label="District">
              <Select value={districtId} onChange={(v) => setDistrictId(v)} options={[{value:"",label:"Any"}].concat(filteredDistricts.map(d => ({ value: d.district_id, label: d.district_name })))} />
            </FormField>
          </div>

          <div>
            <FormField label="Role">
              <Select value={roleId} onChange={(v) => setRoleId(v)} options={[{value:"",label:"Any"}].concat(roles.map(r => ({ value: r.role_id, label: r.role_name })))} />
            </FormField>
          </div>

          <div>
            <FormField label="Designation">
              <Select value={designationId} onChange={(v) => setDesignationId(v)} options={[{value:"",label:"Any"}].concat(designations.map(d => ({ value: d.designation_id, label: d.designation_name })))} />
            </FormField>
          </div>

          <div>
            <FormField label="Department">
              <Select value={departmentId} onChange={(v) => setDepartmentId(v)} options={[{value:"",label:"Any"}].concat(departments.map(d => ({ value: d.department_id, label: d.department_name })))} />
            </FormField>
          </div>

          <div className="flex items-end gap-2">
            <PrimaryBtn onClick={() => setTableKey(k => k + 1)}>Apply</PrimaryBtn>
            <SecondaryBtn onClick={() => {
              setSearch(""); setStateId(""); setDistrictId(""); setRoleId(""); setDesignationId(""); setDepartmentId(""); setPageSize(DEFAULT_PAGE_SIZE);
              setTableKey(k => k + 1);
            }}>Clear</SecondaryBtn>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg shadow-sm border mb-6">
        <ServerDataTable
          key={tableKey}
          columns={columns}
          onFetch={onFetch}
          initialPageSize={pageSize}
          selectable={false}
        />
      </div>

      {/* Modal: Create / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          {/* FIXED: only close when clicking the backdrop element itself (target === currentTarget)
              This prevents accidental backdrop-close when the file dialog opens. */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={(e) => {
              // check ref for immediate value (state may be stale)
              if (e.target === e.currentTarget && !isSelectingFileRef.current) {
                closeModal();
              }
            }}
          />

          <div className="relative z-10 w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <img src="/images/Ank_Logo.png" alt="logo" className="h-10 w-auto object-contain" />
                <div>
                  <div className="text-lg font-semibold">{editing ? "Edit Faculty" : "Add Faculty"}</div>
                  <div className="text-xs text-slate-400">Create or update faculty record</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => closeModal()} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormField label="Full name *" required error={errors.full_name}>
                    <TextInput value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} clearable />
                  </FormField>
                </div>

                <div>
                  <FormField label="Contact" error={errors.contact}>
                    <TextInput value={form.contact} onChange={(v) => setForm(f => ({ ...f, contact: v }))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="Email" error={errors.email}>
                    <TextInput value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="DOB">
                    <DateInput value={form.dob} onChange={(v) => setForm(f => ({ ...f, dob: v }))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="State">
                    <Select value={form.state_id} onChange={(v) => { setForm(f => ({ ...f, state_id: v, district_id: "" })); }} options={[{value:"",label:"Select state"}].concat(states.map(s => ({ value: s.state_id, label: s.state_name })))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="District">
                    <Select value={form.district_id} onChange={(v) => setForm(f => ({ ...f, district_id: v }))} options={[{value:"",label:"Select district"}].concat(filteredDistricts.map(d => ({ value: d.district_id, label: d.district_name })))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="Role">
                    <Select value={form.role_id} onChange={(v) => setForm(f => ({ ...f, role_id: v }))} options={[{value:"",label:"Select role"}].concat(roles.map(r => ({ value: r.role_id, label: r.role_name })))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="Designation">
                    <Select value={form.designation_id} onChange={(v) => setForm(f => ({ ...f, designation_id: v }))} options={[{value:"",label:"Select designation"}].concat(designations.map(d => ({ value: d.designation_id, label: d.designation_name })))} />
                  </FormField>
                </div>

                <div>
                  <FormField label="Department">
                    <Select value={form.department_id} onChange={(v) => setForm(f => ({ ...f, department_id: v }))} options={[{value:"",label:"Select department"}].concat(departments.map(d => ({ value: d.department_id, label: d.department_name })))} />
                  </FormField>
                </div>

                <div className="col-span-2">
                  <FormField label="Address">
                    <TextArea value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
                  </FormField>
                </div>

                {/* photo preview + upload */}
                <div className="col-span-2 flex items-center gap-4">
                  <div className="h-28 w-28 overflow-hidden rounded-md bg-white shadow-sm flex-shrink-0">
                    <img src={form.image || DEFAULT_PHOTO} alt="preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)} />
                  </div>

                  <div className="flex flex-col">
                    <input
                      ref={hiddenFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onClick={(e) => { e.stopPropagation(); }}
                      onMouseDown={(e) => { e.stopPropagation(); }}
                      onFocus={() => {
                        // user opened file picker via keyboard or clicked input directly
                        isSelectingFileRef.current = true;
                        setIsSelectingFile(true);
                      }}
                      onChange={(ev) => {
                        // set ref/state immediately, then handle files
                        isSelectingFileRef.current = true;
                        setIsSelectingFile(true);
                        handlePhotoFiles(ev.target.files);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <PrimaryBtn
                        size="sm"
                        // set ref and open file picker synchronously on mouse down to avoid backdrop race
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          isSelectingFileRef.current = true;
                          setIsSelectingFile(true);
                          try {
                            hiddenFileRef.current && hiddenFileRef.current.click();
                          } catch (err) {
                            // some browsers may throw if input not in DOM yet; swallow
                            console.warn("file input click failed", err);
                          }
                        }}
                        // keyboard support: open file picker on Enter/Space
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            isSelectingFileRef.current = true;
                            setIsSelectingFile(true);
                            hiddenFileRef.current && hiddenFileRef.current.click();
                          }
                        }}
                      >
                        Upload Photo
                      </PrimaryBtn>
                      {form.image && (
                        <button type="button" className="px-3 py-1 rounded-md border" onClick={() => setForm(f => ({ ...f, image: "" }))}>Remove</button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-2">Max {Math.round(UPLOAD_MAX_BYTES/1024)}KB. JPG/PNG recommended.</div>
                    {errors.image && <div className="text-xs text-rose-600 mt-1">{errors.image}</div>}
                  </div>
                </div>
              </div>

              <hr />

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <ToggleSwitch checked={!!form.create_user} onChange={(v) => setForm(f => ({ ...f, create_user: v }))} />
                  <div className="text-sm">Create linked user</div>
                </div>

                <div />
              </div>

              {form.create_user && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Username">
                    <TextInput value={form.username} onChange={(v) => setForm(f => ({ ...f, username: v }))} />
                  </FormField>

                  <FormField label="User Email">
                    <TextInput value={form.user_email} onChange={(v) => setForm(f => ({ ...f, user_email: v }))} />
                  </FormField>

                  <div className="col-span-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4" checked={form.sync_user_role} onChange={(e) => setForm(f => ({ ...f, sync_user_role: e.target.checked }))} />
                      <span className="text-sm">Sync user role with employee role</span>
                    </label>
                  </div>
                </div>
              )}

              {errors.form && <div className="text-sm text-rose-600">{errors.form}</div>}

              <div className="flex justify-end gap-3">
                <CancelBtn onClick={() => closeModal()} />
                <SaveBtn type="submit" loading={saving} />
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}

/* --------------------
   small helpers
   -------------------- */
function districtListForState(allDistricts, stateId) {
  if (!stateId) return allDistricts || [];
  return (allDistricts || []).filter(d => String(d.state_id) === String(stateId));
}
