// src/pages/schools.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../lib/api";
import { ServerDataTable } from "../components/table.jsx"; // server-side table

// buttons
import {
  CreateBtn,
  PrimaryBtn,
  SecondaryBtn,
  FileUploadBtn,
  SaveBtn,
  CancelBtn,
  DeleteBtn
} from "../components/buttons.jsx";

// inputs (from your input-components file)
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  ToggleSwitch
} from "../components/input.jsx";

/*
  Schools management page
  - ServerDataTable handles paging; we pass `key={tableKey}` to force refresh when needed
  - Small PrimaryBtn used to trigger the hidden file input for logo upload
  - Inline validation messages displayed under each FormField using the `error` prop
  - Modal/backdrop updated to avoid accidental close when file dialog opens (isSelectingFile flag)
*/

const DEFAULT_PAGE_SIZE = 25;
const UPLOAD_MAX_BYTES = 50 * 1024; // 50 KB
const DEFAULT_LOGO = "/images/ANK.png";
const MODAL_HEADER_LOGO = "/images/Ank_Logo.png";

export default function SchoolsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(defaultForm());
  const [mediums, setMediums] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [errors, setErrors] = useState({});
  const [tableKey, setTableKey] = useState(0); // increment to force ServerDataTable remount/refresh

  // Tracks when the native file picker is expected to be open to avoid accidental modal close
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchLookups();
    // make sure we clear isSelectingFile if window regains focus (file dialog closed)
    const onFocus = () => setIsSelectingFile(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function defaultForm() {
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

  /* -------------------------
     Data fetching / lookups
     ------------------------- */
  async function fetchLookups() {
    try {
      const m = await api.get("/api/master/mediums");
      setMediums(m.data || []);
    } catch (e) {
      console.warn("Failed to load mediums", e.message || e);
      setMediums([]);
    }

    try {
      const s = await api.get("/api/master", { query: { table: "states" } });
      setStates(s.data || s || []);
    } catch (e) {
      console.warn("Failed to load states", e.message || e);
      setStates([]);
    }

    try {
      const d = await api.get("/api/master", { query: { table: "districts" } });
      setDistricts(d.data || d || []);
    } catch (e) {
      console.warn("Failed to load districts", e.message || e);
      setDistricts([]);
    }
  }

  /* -------------------------
     Modal form helpers
     ------------------------- */
  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setFormError("");
    setErrors({});
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
    setFormError("");
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    // don't close if user is currently selecting a file (or shortly after)
    if (isSelectingFile) {
      // ignore the close request; the window.focus handler will clear the flag
      return;
    }
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setErrors({});
  }

  /* input handlers for native inputs still present elsewhere */
  function handleInput(e) {
    const { name, value, dataset } = e.target;
    if (dataset.group === "user") {
      setForm((f) => ({ ...f, user: { ...f.user, [name]: value } }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    // clear corresponding error
    setErrors((err) => ({ ...err, [dataset.group === "user" ? `user.${name}` : name]: undefined }));
  }

  function handleCheckbox(e) {
    const { name, checked, dataset } = e.target;
    if (dataset.group === "user") {
      setForm((f) => ({ ...f, user: { ...f.user, [name]: checked } }));
    } else {
      setForm((f) => ({ ...f, [name]: checked }));
    }
    setErrors((err) => ({ ...err, [dataset.group === "user" ? `user.${name}` : name]: undefined }));
  }

  function buildUserPayload() {
    const u = form.user || {};
    if ((u.username && u.username.trim()) || (u.email && u.email.trim()) || (u.password && u.password.trim())) {
      const payload = {
        username: u.username?.trim() || undefined,
        email: u.email?.trim() || undefined,
        password: u.password || undefined,
        must_change_password: !!u.must_change_password,
        role_name: u.role_name || "school_admin",
      };
      const hasAny = Object.values(payload).some((v) => v !== undefined && v !== "");
      return hasAny ? payload : undefined;
    }
    return undefined;
  }

  /* -------------------------
     Upload logo (multiple endpoints)
     ------------------------- */
  async function uploadLogo(file) {
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      const msg = `File too large — max ${Math.round(UPLOAD_MAX_BYTES / 1024)}KB allowed.`;
      setFormError(msg);
      window.ui?.toast?.(msg, "danger");
      return;
    }

    const fd = new FormData();
    fd.append("logo", file);

    const candidatePaths = [
      "/api/schools/schools/upload-logo",
      "/api/schools/schools/school/upload-logo",
      "/api/schools/schools/schools/upload-logo",
    ];

    let lastErr = null;
    for (const p of candidatePaths) {
      try {
        const res = await api.post(p, fd, { headers: {} });
        const url = res?.url || (res?.data && res.data.url) || (typeof res === "string" ? res : undefined);
        if (url) {
          setForm((f) => ({ ...f, image: url }));
        } else if (res && res.data && res.data.path) {
          setForm((f) => ({ ...f, image: res.data.path }));
        } else {
          setFormError("Upload succeeded but server didn't return image URL");
        }
        window.ui?.toast?.("Logo uploaded", "success");
        return;
      } catch (err) {
        lastErr = err;
        const status = err?.status;
        const msg = err?.message || (err?.data && err.data.message) || "";
        if (status === 404 || /Cannot (POST|PUT|GET)/i.test(msg) || /Not Found/i.test(msg)) {
          continue;
        }
        const userMsg = err?.data?.message || err?.message || "Upload failed";
        setFormError(userMsg);
        window.ui?.toast?.(userMsg, "danger");
        return;
      }
    }

    console.error("Upload logo failed for all tried endpoints", lastErr);
    const finalMsg = lastErr?.data?.message || lastErr?.message || "Upload endpoint not found on server. Tried multiple paths.";
    setFormError(finalMsg);
    window.ui?.toast?.(finalMsg, "danger");
  }

  /* handle file input change for logo (and preview)
     Accepts either FileList (from input.files) or event-like shape */
  async function onFileChange(eOrFiles) {
    const files = eOrFiles?.target?.files ?? eOrFiles;
    const f = files && files[0];
    if (!f) {
      // clear selecting flag if nothing chosen
      setIsSelectingFile(false);
      return;
    }

    // show preview locally first
    const reader = new FileReader();
    reader.onload = () => {
      setForm((fr) => ({ ...fr, image: reader.result }));
    };
    reader.readAsDataURL(f);

    // attempt upload while keeping selecting flag true until finished
    try {
      await uploadLogo(f);
    } finally {
      // ensure we clear selecting flag when done (and remove input value)
      setIsSelectingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* -------------------------
     Save / create / update (with inline validation)
     ------------------------- */
  async function saveSchool(e) {
    e?.preventDefault?.();
    setSaving(true);
    setFormError("");
    setErrors({});

    try {
      // inline validation
      const newErrors = {};
      if (!form.school_name || !form.school_name.trim()) newErrors.school_name = "School name is required";
      if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Valid email required";
      if (form.contact_no && !/^[\d+\-\s()]{6,20}$/.test(form.contact_no)) newErrors.contact_no = "Enter a valid phone number";

      // user validations (if provided)
      if (form.user?.email && !/^\S+@\S+\.\S+$/.test(form.user.email)) newErrors["user.email"] = "Valid email required";
      if (form.user?.password && form.user.password.length > 0 && form.user.password.length < 8) newErrors["user.password"] = "Password must be >= 8 characters";

      if (Object.keys(newErrors).length) {
        setErrors(newErrors);
        setSaving(false);
        return;
      }

      const payload = {
        school_name: form.school_name,
        address: form.address || null,
        district_id: form.district_id || null,
        state_id: form.state_id || null,
        medium_id: form.medium_id || null,
        contact_person: form.contact_person || null,
        contact_no: form.contact_no || null,
        email: form.email,
        image: form.image || null,
      };

      const userPayload = buildUserPayload();
      if (userPayload) payload.user = userPayload;

      if (editing && editing.school_id) {
        await api.put(`/api/schools/schools/${editing.school_id}`, payload);
        window.ui?.toast?.("School updated", "success");
      } else {
        await api.post("/api/schools/schools", payload);
        window.ui?.toast?.("School created", "success");
      }

      // refresh table by remounting it (server fetch will be triggered)
      setTableKey((k) => k + 1);

      closeModal();
    } catch (err) {
      console.error("Save school error", err);
      const msg = err?.data?.message || err?.message || "Failed to save school";
      setFormError(msg);
      if (err?.status === 409) window.ui?.toast?.("Username or email already exists", "danger");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------
     Delete / export / import
     ------------------------- */
  async function doDelete(row) {
    if (!window.confirm(`Delete school "${row.school_name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/api/schools/schools/${row.school_id}`);
      window.ui?.toast?.("School deleted", "success");
      setTableKey((k) => k + 1); // refresh table
    } catch (err) {
      console.error("Delete school error", err);
      const msg = err?.data?.message || err?.message || "Failed to delete";
      window.ui?.toast?.(msg, "danger");
    }
  }

  async function exportCsv() {
    try {
      await api.download("/api/schools/schools/export/csv", { filename: "schools.csv" });
    } catch (err) {
      console.error("Export CSV error", err);
      window.ui?.toast?.(err?.message || "Export failed", "danger");
    }
  }

  async function exportXlsx() {
    try {
      await api.download("/api/schools/schools/export/xlsx", { filename: "schools.xlsx" });
    } catch (err) {
      console.error("Export XLSX error", err);
      window.ui?.toast?.(err?.message || "Export failed", "danger");
    }
  }

  async function importCsv(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await api.post("/api/schools/schools/import", fd, { headers: {} });
      window.ui?.toast?.(res?.message || "Import done", "success");
      setTableKey((k) => k + 1);
    } catch (err) {
      console.error("Import error", err);
      window.ui?.toast?.(err?.data?.message || err?.message || "Import failed", "danger");
    } finally {
      e.target.value = "";
    }
  }

  /* -------------------------
     Helpers for rendering images with fallback
     ------------------------- */
  function LogoImg({ src, alt = "", className = "h-12 w-12 object-cover rounded-md" }) {
    const [s, setS] = useState(src || "");
    useEffect(() => setS(src || ""), [src]);
    return (
      <img
        src={s || DEFAULT_LOGO}
        alt={alt}
        className={className}
        onError={() => setS(DEFAULT_LOGO)}
      />
    );
  }

  /* -------------------------
     ServerDataTable: columns + onFetch
     ------------------------- */
  const columns = [
    {
      Header: "Logo",
      accessor: "image",
      Cell: (r) => {
        const src = r.image || DEFAULT_LOGO;
        return (
          <div className="h-12 w-12 overflow-hidden flex items-center justify-center bg-white">
            <img src={src} alt={r.school_name} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = DEFAULT_LOGO)} />
          </div>
        );
      },
    },
    { Header: "Name", accessor: "school_name", Cell: (r) => (<div><div className="text-lg font-medium">{r.school_name}</div><div className="text-sm text-gray-500">{r.address}</div></div>) },
    { Header: "Contact", accessor: "contact_person", Cell: (r) => (<div><div className="text-sm">{r.contact_person || "-"}</div><div className="text-sm text-gray-500">{r.contact_no || "-"}</div></div>) },
    { Header: "Email", accessor: "email" },
    { Header: "Medium", accessor: "medium_name" },
    { Header: "Created", accessor: "created_at", Cell: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "") },
    {
      Header: "Actions",
      accessor: "actions",
      Cell: (r) => (
        <div className="flex gap-2">
          <PrimaryBtn size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</PrimaryBtn>
          <DeleteBtn size="sm" onClick={(e) => { e.stopPropagation(); doDelete(r); }}>Delete</DeleteBtn>
        </div>
      )
    },
  ];

  // onFetch passed to ServerDataTable; it will be called with { page, pageSize, sortBy, sortDir }
  const onFetch = useCallback(async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, sortDir }) => {
    const query = { page, pageSize, search: search || undefined };
    if (sortBy) {
      query.sortBy = typeof sortBy === "string" ? sortBy : (sortBy.accessor || sortBy);
      query.sortDir = sortDir || "asc";
    }
    try {
      const res = await api.get("/api/schools/schools", { query });
      const rows = res.data || [];
      const total = (res.pagination && res.pagination.total) || (res.total ?? rows.length) || 0;
      setData(rows);
      setTotal(total);
      return { data: rows, total };
    } catch (err) {
      console.error("ServerDataTable fetch error", err);
      setData([]);
      setTotal(0);
      return { data: [], total: 0 };
    }
  }, [search]);

  return (
    <div className="p-6 text-base antialiased">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">Schools</h2>
            <div className="text-sm text-gray-500">Manage registered schools & their admins</div>
          </div>
        </div>

        <div className="flex gap-2">
          <CreateBtn onClick={openCreate} />
          <SecondaryBtn onClick={exportCsv}>Export CSV</SecondaryBtn>
          <SecondaryBtn onClick={exportXlsx}>Export XLSX</SecondaryBtn>

          <FileUploadBtn onChange={importCsv} accept=".csv,text/csv">
            Import CSV
          </FileUploadBtn>
        </div>
      </div>

      <div className="mb-4 flex gap-3 items-center">
        <input
          placeholder="Search by name / email / username"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input input-md flex-1 text-lg"
        />
        <PrimaryBtn onClick={() => setTableKey(k => k + 1)}>Search</PrimaryBtn>
      </div>

      {formError && <div className="text-red-600 mb-3 text-sm">{formError}</div>}

      {/* Server-driven table. key={tableKey} forces remount/refresh when tableKey changes */}
      <div className="overflow-x-auto rounded-lg shadow-sm border">
        <ServerDataTable
          key={tableKey}
          columns={columns}
          onFetch={onFetch}
          initialPageSize={DEFAULT_PAGE_SIZE}
          selectable={false}
        />
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          {/* Backdrop: clicking this closes the modal — but ignore if file picker is active */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!isSelectingFile) closeModal();
            }}
          />

          {/* Modal content: stop clicks from reaching the backdrop */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal header with Ank logo */}
            <div className="flex items-center gap-4 p-4 rounded-t-2xl" style={{ background: "linear-gradient(90deg,#E1E0ECFF 0%, #C8E6EEFF 100%)" }}>
              <img src={MODAL_HEADER_LOGO} alt="Ank" className="h-16 w-auto rounded-none shadow-md" onError={(e)=> (e.currentTarget.src = DEFAULT_LOGO)} />
              <div>
                <h2 className="text-xl font-semibold text-black">{editing ? `Edit: ${editing.school_name}` : "Create School"}</h2>
                <div className="text-sm opacity-100 text-black">Fill school details and optional user account</div>
              </div>

              <div className="ml-auto">
                <SecondaryBtn onClick={closeModal}>Close</SecondaryBtn>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6">
              <form onSubmit={saveSchool} className="space-y-4" onClick={(e)=> e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormField label="School Name *" required error={errors.school_name}>
                      <TextInput
                        value={form.school_name}
                        onChange={(v) => { setForm((f) => ({ ...f, school_name: v })); setErrors((e) => ({ ...e, school_name: undefined })); }}
                        placeholder="School name"
                        className="w-full"
                        clearable
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Email *" required error={errors.email}>
                      <TextInput
                        value={form.email}
                        onChange={(v) => { setForm((f) => ({ ...f, email: v })); setErrors((e) => ({ ...e, email: undefined })); }}
                        placeholder="school@example.com"
                        className="w-full"
                        clearable
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Contact Person" error={errors.contact_person}>
                      <TextInput
                        value={form.contact_person}
                        onChange={(v) => { setForm((f) => ({ ...f, contact_person: v })); setErrors((e) => ({ ...e, contact_person: undefined })); }}
                        placeholder="Contact person"
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Contact No" error={errors.contact_no}>
                      <TextInput
                        value={form.contact_no}
                        onChange={(v) => { setForm((f) => ({ ...f, contact_no: v })); setErrors((e) => ({ ...e, contact_no: undefined })); }}
                        placeholder="+91 9xxxx xxxxx"
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="State" error={errors.state_id}>
                      <Select
                        value={form.state_id || ""}
                        onChange={(v) => { setForm((f) => ({ ...f, state_id: v })); setErrors((e) => ({ ...e, state_id: undefined })); }}
                        options={states.map((s) => ({ value: s.state_id || s.id, label: s.state_name || s.name }))}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="District" error={errors.district_id}>
                      <Select
                        value={form.district_id || ""}
                        onChange={(v) => { setForm((f) => ({ ...f, district_id: v })); setErrors((e) => ({ ...e, district_id: undefined })); }}
                        options={districts.map((d) => ({ value: d.district_id || d.id, label: d.district_name || d.name }))}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Medium" error={errors.medium_id}>
                      <Select
                        value={form.medium_id || ""}
                        onChange={(v) => { setForm((f) => ({ ...f, medium_id: v })); setErrors((e) => ({ ...e, medium_id: undefined })); }}
                        options={mediums.map((m) => ({ value: m.medium_id || m.id, label: m.medium_name || m.name }))}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Address" error={errors.address}>
                      <TextInput
                        value={form.address}
                        onChange={(v) => { setForm((f) => ({ ...f, address: v })); setErrors((e) => ({ ...e, address: undefined })); }}
                      />
                    </FormField>
                  </div>

                  {/* Logo preview + upload (PrimaryBtn trigger). Key changes:
                      - hidden file input stops propagation on click
                      - file input onFocus/onClick set isSelectingFile = true
                      - file input onChange clears isSelectingFile after upload
                      - backdrop ignores clicks while isSelectingFile is true
                  */}
                  <div className="col-span-2 flex items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-28 w-28 overflow-hidden shadow-lg bg-white flex-shrink-0">
                        <img src={form.image || DEFAULT_LOGO} alt="logo-preview" className="object-cover h-full w-full" onError={(e) => (e.currentTarget.src = DEFAULT_LOGO)} />
                      </div>

                      <div className="flex flex-col">
                        {/* hidden file input: stop propagation on click so nothing bubbles.
                            onFocus marks selecting state; onChange clears it */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onClick={(e) => { e.stopPropagation(); }}
                          onFocus={() => setIsSelectingFile(true)}
                          onChange={(ev) => {
                            // mark selecting in case onFocus didn't run
                            setIsSelectingFile(true);
                            onFileChange(ev.target.files);
                          }}
                        />

                        <div className="flex items-center gap-2">
                          {/* Use onMouseDown to prevent default focus/blur that can trigger other handlers.
                              Set isSelectingFile before opening picker to prevent backdrop close. */}
                          <PrimaryBtn
                            size="sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              // mark file selection about to happen
                              setIsSelectingFile(true);
                              fileInputRef.current && fileInputRef.current.click();
                            }}
                          >
                            Upload Logo
                          </PrimaryBtn>

                          {form.image && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, image: "" })); }}
                              className="px-3 py-1 rounded-md border"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">Max: {Math.round(UPLOAD_MAX_BYTES / 1024)}KB. PNG/JPG recommended.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="my-2" />

                <h4 className="font-semibold text-lg">Optional: Create / Update User for this School</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormField label="Username" error={errors["user.username"]}>
                      <TextInput
                        value={form.user.username}
                        onChange={(v) => { setForm((f) => ({ ...f, user: { ...f.user, username: v } })); setErrors((e) => ({ ...e, ["user.username"]: undefined })); }}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="User Email" error={errors["user.email"]}>
                      <TextInput
                        value={form.user.email}
                        onChange={(v) => { setForm((f) => ({ ...f, user: { ...f.user, email: v } })); setErrors((e) => ({ ...e, ["user.email"]: undefined })); }}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField label="Password" error={errors["user.password"]}>
                      <TextInput
                        type="password"
                        value={form.user.password}
                        onChange={(v) => { setForm((f) => ({ ...f, user: { ...f.user, password: v } })); setErrors((e) => ({ ...e, ["user.password"]: undefined })); }}
                      />
                    </FormField>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <ToggleSwitch checked={!!form.user.must_change_password} onChange={(val) => setForm((f) => ({ ...f, user: { ...f.user, must_change_password: val } }))} />
                    </div>
                    <label htmlFor="must_change" className="text-sm select-none">Force change password on first login</label>
                  </div>
                </div>

                {formError && <div className="text-red-600 mt-2">{formError}</div>}

                <div className="mt-4 flex justify-end gap-3">
                  <CancelBtn onClick={closeModal} />
                  <SaveBtn type="submit" loading={saving} />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
