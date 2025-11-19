// src/pages/courses.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";
import ERPIcons from "../components/icons.jsx";
import { FormField, TextInput, Select, FileInput } from "../components/input.jsx";
import { SimpleTable, ExportCSV } from "../components/table.jsx";

const defaultImg = "/images/ANK.png";
const headerLogo = "/images/Ank_Logo.png";

const imgSrcOrDefault = (url) => (url && String(url).trim()) ? url : defaultImg;

export default function CoursesPage() {
  // lookups
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [books, setBooks] = useState([]);

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  // filters
  const [q, setQ] = useState("");
  const [fMedium, setFMedium] = useState("");
  const [fStd, setFStd] = useState("");
  const [fBook, setFBook] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    course_id: null,
    course_name: "",
    description: "",
    price: "",
    medium_id: "",
    std_id: "",
    book_id: "",
    image: ""
  });

  // upload state
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(defaultImg);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, sRes, bRes] = await Promise.all([
          api.get("/api/master", { query: { table: "media", pageSize: 1000 } }),
          api.get("/api/master", { query: { table: "standards", pageSize: 1000 } }),
          api.get("/api/books", { query: { pageSize: 1000 } })
        ]);
        setMediums(mRes?.data || []);
        setStandards(sRes?.data || []);
        setBooks(bRes?.data || []);
      } catch (err) {
        console.error("lookups", err);
        window.ui?.toast?.("Failed to load lookups", "warning");
      }
    })();
  }, []);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, fMedium, fStd, fBook]);

  async function fetchRows() {
    setLoading(true);
    try {
      const query = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (q) query.search = q;
      if (fMedium) query.medium_id = fMedium;
      if (fStd) query.std_id = fStd;
      if (fBook) query.book_id = fBook;

      const res = await api.get("/api/courses", { query });
      const data = res?.data || [];
      const pg = res?.pagination || { page: pagination.page, pageSize: pagination.pageSize, total: data.length };
      setRows(data);
      setPagination({ page: pg.page, pageSize: pg.pageSize, total: pg.total });
    } catch (err) {
      console.error("fetch courses", err);
      window.ui?.toast?.("Failed to load courses", "danger");
      setRows([]);
      setPagination(p => ({ ...p, total: 0 }));
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({
      course_id: null,
      course_name: "",
      description: "",
      price: "",
      medium_id: "",
      std_id: "",
      book_id: "",
      image: ""
    });
    setFilePreview(defaultImg);
    fileRef.current = null;
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      course_id: row.course_id,
      course_name: row.course_name || "",
      description: row.description || "",
      price: row.price ?? "",
      medium_id: row.medium_id ?? "",
      std_id: row.std_id ?? "",
      book_id: row.book_id ?? "",
      image: row.image || ""
    });
    setFilePreview(imgSrcOrDefault(row.image));
    fileRef.current = null;
    setModalOpen(true);
  }

  async function deleteRow(row) {
    if (!confirm("Delete this course?")) return;
    try {
      await api.delete(`/api/courses/${row.course_id}`);
      window.ui?.toast?.("Course deleted", "success");
      fetchRows();
    } catch (err) {
      console.error("delete course", err);
      window.ui?.toast?.("Delete failed", "danger");
    }
  }

  async function uploadFile(file) {
    if (!file) return null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await api.post("/api/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        const url = res?.data?.url ?? res?.data?.fileUrl ?? null;
        if (url) return url;
      } catch (e) {
        try {
          const res2 = await api.post("/api/courses/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
          const url2 = res2?.data?.url ?? res2?.data?.fileUrl ?? null;
          if (url2) return url2;
        } catch (ee) {
          console.warn("upload endpoints failed", ee);
        }
      }
      // fallback to dataURL
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      return dataUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    // createObjectURL for immediate preview; keep fileRef for upload
    try {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      fileRef.current = file;
    } catch (err) {
      console.warn("file preview error", err);
      fileRef.current = file;
    }
  }

  function handleImageUrlChange(v) {
    setForm(f => ({ ...f, image: v }));
    setFilePreview(imgSrcOrDefault(v));
    fileRef.current = null;
  }

  async function handleSave(e) {
    e && e.preventDefault && e.preventDefault();
    if (!form.course_name || !String(form.course_name).trim()) {
      window.ui?.toast?.("Course name required", "danger");
      return;
    }

    try {
      let imageUrl = form.image ? String(form.image).trim() : null;
      if (fileRef.current) {
        const uploaded = await uploadFile(fileRef.current);
        if (uploaded) imageUrl = uploaded;
      }

      const payload = {
        course_name: String(form.course_name).trim(),
        description: form.description ? String(form.description).trim() : null,
        price: form.price ? Number(form.price) : null,
        image: imageUrl || null,
        medium_id: form.medium_id ? Number(form.medium_id) : null,
        std_id: form.std_id ? Number(form.std_id) : null,
        book_id: form.book_id ? Number(form.book_id) : null
      };

      if (editing && editing.course_id) {
        await api.put(`/api/courses/${editing.course_id}`, payload);
        window.ui?.toast?.("Course updated", "success");
      } else {
        await api.post("/api/courses", payload);
        window.ui?.toast?.("Course created", "success");
      }

      setModalOpen(false);
      setEditing(null);
      fileRef.current = null;
      // revoke object URL if used
      if (filePreview && filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview);
      fetchRows();
    } catch (err) {
      console.error("save course", err);
      window.ui?.toast?.(err?.message || "Save failed", "danger");
    }
  }

  const columns = [
    { Header: "Name", accessor: "course_name" },
    { Header: "Medium", accessor: (r) => r.medium_name || "—" },
    { Header: "Standard", accessor: (r) => r.std_name || "—" },
    { Header: "Book", accessor: (r) => r.book_name || "—" },
    { Header: "Price", accessor: (r) => r.price ? `₹ ${r.price}` : "—" },
    { Header: "Image", accessor: (r) => <img src={imgSrcOrDefault(r.image)} alt={r.course_name} style={{ height: 48, borderRadius: 6 }} /> },
    {
      Header: "Actions", accessor: (r) => (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => openEdit(r)} className="btn" title="Edit"><ERPIcons.Edit style={{ width: 16, height: 16 }} /></button>
          <button onClick={() => deleteRow(r)} className="btn" title="Delete"><ERPIcons.Delete style={{ width: 16, height: 16 }} /></button>
        </div>
      )
    }
  ];

  const mkOpts = (list, idKey, labelKey) => [{ value: "", label: "— any —" }].concat((list || []).map(x => ({ value: x[idKey], label: x[labelKey] })));

  return (
    <main className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto", fontSize: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');

        :root {
          --bg: #f7fbff;
          --card: #ffffff;
          --muted: #556170;
          --accent-2: #0B6EFF;
          --accent: #0ea5a3;
          --glass: rgba(255,255,255,0.6);
          --radius: 12px;
        }

        .page-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,252,255,0.98));
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 14px 40px rgba(11,34,80,0.04);
          border: 1px solid rgba(11,34,80,0.04);
        }

        .controls { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; }
        .control { min-width:160px; flex: 1 1 200px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid rgba(11,34,80,0.06); background:white; cursor:pointer; font-weight:600; font-size:15px; }
        .btn-primary { background: linear-gradient(90deg, #06b6d4, var(--accent)); color:white; border:none; box-shadow: 0 10px 28px rgba(11,110,255,0.08); }
        .small-muted { color:var(--muted); font-size:13px; }

        .modal-plate { width: 920px; max-width: 96%; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(11,34,80,0.14); }
        .modal-header-bar { display:flex; align-items:center; gap:12px; padding:18px 20px; background: linear-gradient(90deg, #fbfdff, #ffffff); }
        .modal-header-bar img { height:44px; width:auto; display:block; border-radius:8px; }
        .modal-title { flex:1; text-align:center; font-size:18px; font-weight:700; color:#0f172a; }
        .modal-body-grid { display:grid; grid-template-columns: 1fr 360px; gap:18px; padding:18px; background: #fff; }
        .preview-card { border-radius:10px; padding:12px; border:1px solid rgba(11,34,80,0.06); background: linear-gradient(180deg,#ffffff,#fbfdff); display:flex; gap:12px; align-items:center; }
        .modal-footer-bar { display:flex; gap:12px; justify-content:flex-end; padding:14px 18px; background:#fcfeff; border-top: 1px solid rgba(11,34,80,0.03); }

        /* subtle doodles to align with sidebar look */
        .doodle-left { position:absolute; left:-40px; top:-30px; width:160px; height:160px; opacity:0.9; pointer-events:none; filter: blur(0.2px); transform-origin:center; animation: floatL 8s ease-in-out infinite; }
        .doodle-right { position:absolute; right:-40px; bottom:-40px; width:140px; height:140px; opacity:0.9; pointer-events:none; filter: blur(0.2px); transform-origin:center; animation: floatR 9s ease-in-out infinite; }
        @keyframes floatL { 0%{ transform: translateY(0) rotate(-2deg); } 50%{ transform: translateY(6px) rotate(2deg); } 100%{ transform: translateY(0) rotate(-2deg); } }
        @keyframes floatR { 0%{ transform: translateY(0) rotate(2deg); } 50%{ transform: translateY(-6px) rotate(-2deg); } 100%{ transform: translateY(0) rotate(2deg); } }

        /* responsive */
        @media (max-width: 980px) {
          .modal-body-grid { grid-template-columns: 1fr; }
          .preview-card img { display:block; margin: 0 auto; }
        }
      `}</style>

      {/* decorative doodles */}
      <svg className="doodle-left" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs><linearGradient id="c1" x1="0" x2="1"><stop offset="0" stopColor="#E6F6FF"/><stop offset="1" stopColor="#F0EBFF"/></linearGradient></defs>
        <path fill="url(#c1)" d="M43.1,-45.9C56.4,-32.6,67.1,-18.1,67.1,-2.1C67.1,13.9,56.4,29.9,43.1,42.5C29.9,55.1,14.9,64.3,-0.1,64.4C-15.1,64.5,-30.1,55.5,-42.1,43.5C-54,31.5,-63,16.5,-64.5,-0.3C-66,-17.1,-60,-34.3,-47.6,-47.6C-35.2,-60.9,-17.6,-70.3,-0.1,-70.2C17.3,-70.1,34.6,-60.9,43.1,-45.9Z" transform="translate(100 100)" />
      </svg>
      <svg className="doodle-right" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs><linearGradient id="c2" x1="0" x2="1"><stop offset="0" stopColor="#FFFBE6"/><stop offset="1" stopColor="#E8FFF6"/></linearGradient></defs>
        <path fill="url(#c2)" d="M38.5,-40.3C50.2,-31,60.4,-21.6,64.8,-9.6C69.2,2.4,67.8,17.9,59.8,28.5C51.8,39.1,37.2,44.9,22.4,51.1C7.6,57.3,-8.4,63.8,-22.2,60.6C-36.1,57.4,-47.8,44.5,-57.2,30.6C-66.5,16.6,-73.6,1.6,-70.6,-11.1C-67.7,-23.8,-54.6,-34.2,-40.4,-43C-26.3,-51.7,-13.1,-58.9,-0.3,-58.6C12.6,-58.2,25.2,-50.3,38.5,-40.3Z" transform="translate(100 100)" />
      </svg>

      <div className="page-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Courses</h2>
            <div style={{ color: "var(--muted)", marginTop: 6 }}>Manage course catalog — images, pricing, and mapping to standards/books.</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn" onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchRows(); }} title="Reload">Reload</button>
            <ExportCSV columns={columns} rows={rows} filename={`courses_export_${new Date().toISOString().slice(0,10)}.csv`} />
            <button className="btn btn-primary" onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ERPIcons.Plus style={{ width: 16, height: 16 }} /> New Course
            </button>
          </div>
        </div>

        {/* filters */}
        <div style={{ marginTop: 14 }} className="controls">
          <div className="control">
            <FormField label="Search">
              <TextInput placeholder="Search course name..." value={q} onChange={(v) => { setQ(v); setPagination(p => ({ ...p, page: 1 })); }} />
            </FormField>
          </div>

          <div className="control" style={{ maxWidth: 240 }}>
            <FormField label="Medium">
              <Select value={fMedium} onChange={(v) => { setFMedium(v); setPagination(p => ({ ...p, page: 1 })); }} options={mkOpts(mediums, "medium_id", "medium_name")} />
            </FormField>
          </div>

          <div className="control" style={{ maxWidth: 240 }}>
            <FormField label="Standard">
              <Select value={fStd} onChange={(v) => { setFStd(v); setPagination(p => ({ ...p, page: 1 })); }} options={mkOpts(standards, "std_id", "std_name")} />
            </FormField>
          </div>

          <div className="control" style={{ maxWidth: 240 }}>
            <FormField label="Book">
              <Select value={fBook} onChange={(v) => { setFBook(v); setPagination(p => ({ ...p, page: 1 })); }} options={mkOpts(books, "book_id", "book_name")} />
            </FormField>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <FormField label="Rows">
              <select className="form-control" value={pagination.pageSize} onChange={(e) => setPagination(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}>
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
          </div>
        </div>
      </div>

      <div className="page-card">
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "var(--muted)" }}>{rows.length ? `${(pagination.page-1)*pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}` : "No courses"}</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}>Prev</button>
            <button className="btn" disabled={(pagination.page * pagination.pageSize) >= pagination.total} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next</button>
          </div>
        </div>

        {loading ? <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : (
          <SimpleTable columns={columns} data={rows} emptyMessage="No courses found" />
        )}
      </div>

      {/* Modal: close only on backdrop click (onClick && target === currentTarget) to avoid file picker side-effects */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(180deg, rgba(2,6,23,0.45), rgba(2,6,23,0.35))", zIndex: 9999
          }}
          onClick={(e) => {
            // close only when user clicked the backdrop (not when file dialog or inner elements caused focus changes)
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setEditing(null);
              if (filePreview && filePreview.startsWith("blob:")) {
                try { URL.revokeObjectURL(filePreview); } catch (err) {}
              }
            }
          }}
        >
          <form
            onSubmit={handleSave}
            className="modal-plate"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            // prevent focus loss closing behavior by ensuring clicks inside don't bubble
          >
            <div className="modal-header-bar">
              <img src={headerLogo} alt="Ank Logo" onError={(ev) => { ev.currentTarget.src = headerLogo; }} />
              <div className="modal-title">{editing ? "Edit Course" : "Create a New Course"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" title="Save">
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <ERPIcons.Save style={{ width: 16, height: 16 }} /> {editing ? "Save changes" : "Create course"}
                  </span>
                </button>
              </div>
            </div>

            <div className="modal-body-grid">
              <div>
                <div style={{ display: "grid", gap: 12 }}>
                  <FormField label="Course name" required>
                    <TextInput value={form.course_name} onChange={(v) => setForm(f => ({ ...f, course_name: v }))} />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FormField label="Price">
                      <TextInput type="number" value={form.price} onChange={(v) => setForm(f => ({ ...f, price: v }))} />
                    </FormField>

                    <FormField label="Book">
                      <Select options={[{ value: "", label: "— none —" }, ...(books || []).map(b => ({ value: b.book_id, label: b.book_name }))]} value={form.book_id || ""} onChange={(v) => setForm(f => ({ ...f, book_id: v }))} />
                    </FormField>
                  </div>

                  <FormField label="Description">
                    <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="form-control" rows={4} />
                  </FormField>

                  <div style={{ display: "flex", gap: 8 }}>
                    <FormField label="Medium" className="control" style={{ flex: 1 }}>
                      <Select options={[{ value: "", label: "— none —" }, ...(mediums || []).map(m => ({ value: m.medium_id, label: m.medium_name }))]} value={form.medium_id || ""} onChange={(v) => setForm(f => ({ ...f, medium_id: v }))} />
                    </FormField>

                    <FormField label="Standard" className="control" style={{ flex: 1 }}>
                      <Select options={[{ value: "", label: "— none —" }, ...(standards || []).map(s => ({ value: s.std_id, label: s.std_name }))]} value={form.std_id || ""} onChange={(v) => setForm(f => ({ ...f, std_id: v }))} />
                    </FormField>
                  </div>

                  <FormField label="Image URL (or use Upload)" help="If you paste a remote URL it will be used immediately for preview">
                    <TextInput placeholder="https://..." value={form.image || ""} onChange={(v) => handleImageUrlChange(v)} />
                  </FormField>
                </div>
              </div>

              <div>
                <FormField label="Upload Image">
                  {/* FileInput should be internal to the modal. We stop propagation on parent so click won't close backdrop. */}
                  <FileInput onChange={(files) => handleFileChange(files)} accept="image/*" />
                </FormField>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>Preview</div>
                  <div className="preview-card">
                    <img src={filePreview || imgSrcOrDefault(form.image)} alt="preview" style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{form.course_name || "Untitled course"}</div>
                      <div className="small-muted" style={{ marginTop: 8 }}>{form.description ? (String(form.description).slice(0, 160) + (String(form.description).length > 160 ? "…" : "")) : "No description yet"}</div>
                      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <button type="button" className="btn" onClick={() => {
                          setFilePreview(defaultImg);
                          fileRef.current = null;
                          setForm(f => ({ ...f, image: "" }));
                        }}>Reset</button>
                        <div style={{ marginLeft: "auto", textAlign: "right" }}>
                          <div className="small-muted">Status</div>
                          <div style={{ fontWeight: 700, color: uploading ? "var(--accent)" : "#64748b" }}>{uploading ? "Uploading…" : (editing ? "Ready to save" : "New")}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13 }} className="small-muted">
                    Tip: Uploading a file stores it to the server (if upload endpoint available). Otherwise the image will be embedded locally as a data URL for immediate preview.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer-bar">
              <button type="button" className="btn" onClick={() => { setModalOpen(false); setEditing(null); }}>Close</button>
              <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Create course"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
