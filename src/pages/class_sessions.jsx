// src/pages/class_sessions.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import dayGridPlugin from "@fullcalendar/daygrid";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { PrimaryBtn, SecondaryBtn } from "../components/buttons.jsx";
import { FormField, TextInput, Select, DateInput } from "../components/input.jsx";

/**
 * Class Sessions — improved UI
 * - Compact pivot (print friendly)
 * - Edit modal
 * - Export pivot -> PDF (html2canvas + jsPDF)
 * - Per-session color coding (by school or teacher)
 * - Professional single-line filters
 *
 * Drop into src/pages/class_sessions.jsx
 */

/* ------------- CONFIG ------------- */
const PRESET_PERIOD_TIMES = {
  1: ["07:35:00", "08:10:00"],
  2: ["08:15:00", "08:50:00"],
  3: ["09:00:00", "09:35:00"],
  4: ["09:45:00", "10:20:00"],
  5: ["10:30:00", "11:05:00"],
  6: ["11:15:00", "11:50:00"],
  7: ["12:30:00", "13:05:00"],
  8: ["13:15:00", "13:50:00"],
};

const TRY_BULK_ENDPOINT_FIRST = true;
const toISODate = (d = new Date()) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/* ------------- UTIL ------------- */
// deterministic pastel color from string/number (school_id or teacher_id)
function pastelColorFromKey(key) {
  const s = String(key || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const hue = h;
  const sat = 55 + (h % 20); // 55-75
  const light = 75; // pastel
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function sessionToEvent(s) {
  const date = String(s.session_date || "").slice(0, 10);
  const start = `${date}T${(s.start_time || "00:00:00").slice(0, 8)}`;
  const end = `${date}T${(s.end_time || "00:00:00").slice(0, 8)}`;
  const titleParts = [];
  if (s.std_name) titleParts.push(`Std ${s.std_name}`);
  if (s.division_name) titleParts.push(`/ ${s.division_name}`);
  if (s.employee_name) titleParts.push(`• ${s.employee_name}`);
  const title = titleParts.join(" ");
  return { id: s.cs_id, title: title || (s.school_name || "Session"), start, end, extendedProps: s };
}

/* ------------- COMPONENT ------------- */
export default function ClassSessionsPage() {
  // lookups
  const [schools, setSchools] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [employees, setEmployees] = useState([]);

  // filters / inputs
  const [date, setDate] = useState(toISODate());
  const [timetableId, setTimetableId] = useState("");
  const [periodNo, setPeriodNo] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [stdId, setStdId] = useState("");
  const [divId, setDivId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // sessions & UI state
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("both"); // both|pivot|calendar
  const [compactMode, setCompactMode] = useState(true);
  const [colorBy, setColorBy] = useState("school"); // 'school' or 'teacher'
  const [columns, setColumns] = useState([]);

  // modal state for edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editValues, setEditValues] = useState({ employee_id: "", remark: "", start_time: "", end_time: "" });

  // refs
  const calendarRef = useRef(null);
  const pivotRef = useRef(null);

  // load lookups
  useEffect(() => {
    (async () => {
      try {
        const [sList, stList, dList, eList] = await Promise.all([
          api.get("/api/schools/schools", { query: { pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/master", { query: { table: "standards", pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/master", { query: { table: "divisions", pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/employees", { query: { pageSize: 500 } }).then(r => r?.data || []),
        ]);
        setSchools(sList || []);
        setStandards(stList || []);
        setDivisions(dList || []);
        setEmployees(eList || []);
      } catch (err) {
        console.error("load lookups", err);
        window.ui?.toast?.("Failed to load lookups", "warning");
      }
    })();
  }, []);

  // compute pivot columns
  useEffect(() => {
    const cols = new Set();
    for (const s of sessions) {
      if (s.period_no) cols.add(`P${s.period_no}`);
      else if (s.start_time && s.end_time) cols.add(`${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`);
      else cols.add("Unk");
    }
    const arr = Array.from(cols).sort((a, b) => {
      const ma = a.match(/^P(\d+)$/);
      const mb = b.match(/^P(\d+)$/);
      if (ma && mb) return Number(ma[1]) - Number(mb[1]);
      if (ma && !mb) return -1;
      if (!ma && mb) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    setColumns(arr);
  }, [sessions]);

  // fetch sessions
  async function fetchSessions(q = {}) {
    setLoading(true);
    try {
      const { data } = await api.get("/api/class-sessions", { query: q });
      const rows = (data || []).map(s => {
        if (s.session_date && s.session_date.toISOString) s.session_date = s.session_date.toISOString().slice(0, 10);
        return s;
      });
      setSessions(rows);
      return rows;
    } catch (err) {
      console.error("fetchSessions", err);
      window.ui?.toast?.("Failed to fetch sessions", "warning");
      setSessions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => { fetchSessions({ session_date: date, pageSize: 1000 }); }, []); // eslint-disable-line

  /* ----------------- CRUD ----------------- */

  async function bulkCreateSessions(sessionsToCreate) {
    if (!sessionsToCreate || !sessionsToCreate.length) return { created: 0 };
    if (TRY_BULK_ENDPOINT_FIRST) {
      try {
        const res = await api.post("/api/class-sessions/bulk", { sessions: sessionsToCreate });
        return { created: res?.data?.created_count ?? sessionsToCreate.length, raw: res };
      } catch (err) {
        console.warn("bulk failed", err);
      }
    }
    let created = 0;
    for (const s of sessionsToCreate) {
      try {
        const r = await api.post("/api/class-sessions", s);
        if (r?.data) created++;
      } catch (err) {
        console.error("create session", err, s);
      }
    }
    return { created };
  }

  async function createFromTimetableAPI(payload) {
    return api.post("/api/class-sessions/from-timetable", payload);
  }

  async function updateSession(cs_id, payload) {
    try {
      const res = await api.put(`/api/class-sessions/${cs_id}`, payload);
      window.ui?.toast?.("Session updated", "success");
      await fetchSessions({ session_date: date, pageSize: 1000 });
      return res;
    } catch (err) {
      console.error("updateSession", err);
      window.ui?.toast?.("Update failed", "danger");
      throw err;
    }
  }

  async function deleteSession(cs_id) {
    if (!confirm("Delete this session?")) return;
    try {
      await api.delete(`/api/class-sessions/${cs_id}`);
      window.ui?.toast?.("Deleted", "success");
      await fetchSessions({ session_date: date, pageSize: 1000 });
    } catch (err) {
      console.error("deleteSession", err);
      window.ui?.toast?.("Delete failed", "danger");
    }
  }

  /* ------------- Weekday auto-create ------------- */

  async function fetchTimetableEntriesForWeekday({ weekday, school_id = null, std_id = null, div_id = null, employee_id = null }) {
    const q = { pageSize: 2000, day_of_week: weekday };
    if (school_id) q.school_id = school_id;
    if (std_id) q.std_id = std_id;
    if (div_id) q.div_id = div_id;
    if (employee_id) q.employee_id = employee_id;
    try {
      const res = await api.get("/api/timetables", { query: q });
      return res?.data || [];
    } catch (err) {
      console.error("fetchTimetableEntriesForWeekday", err);
      return [];
    }
  }

  async function createSessionsFromTimetableByWeekday({ targetDate, school_id, std_id, div_id, employee_id, usePresetTimes = true }) {
    if (!targetDate) { window.ui?.toast?.("Pick a date", "warning"); return; }
    const weekdayJs = (new Date(targetDate)).getDay(); // 0..6
    const dow = weekdayJs === 0 ? 7 : weekdayJs;
    const entries = await fetchTimetableEntriesForWeekday({ weekday: dow, school_id, std_id, div_id, employee_id });
    if (!entries.length) { window.ui?.toast?.("No timetable entries for that weekday", "warning"); return { created: 0 }; }

    const sessionsToCreate = entries.map(t => {
      const period = Number(t.period_no) || null;
      const [start_time, end_time] = (usePresetTimes && period && PRESET_PERIOD_TIMES[period]) ? PRESET_PERIOD_TIMES[period] : [t.start_time || null, t.end_time || null];
      return {
        school_id: Number(t.school_id) || (school_id ? Number(school_id) : null),
        school_name: t.school_name || null,
        medium_id: t.medium_id || null,
        std_id: t.std_id || null,
        std_name: t.std_name || null,
        div_id: t.div_id || null,
        division_name: t.division_name || null,
        employee_id: t.employee_id || (employee_id ? Number(employee_id) : null),
        employee_name: t.employee_name || null,
        timetable_id: t.timetable_id || null,
        period_no: period,
        start_time: start_time,
        end_time: end_time,
        session_date: targetDate,
        remark: t.remark || null,
      };
    });

    const res = await bulkCreateSessions(sessionsToCreate);
    await fetchSessions({ session_date: date, pageSize: 1000 });
    window.ui?.toast?.(`${res.created || 0} sessions created`, "success");
    return { created: res.created || 0, entries: sessionsToCreate };
  }

  /* ------------- Modal (edit) ------------- */

  function openEditModal(session) {
    setEditingSession(session);
    setEditValues({
      employee_id: session.employee_id ?? "",
      remark: session.remark ?? "",
      start_time: session.start_time ?? "",
      end_time: session.end_time ?? ""
    });
    setEditOpen(true);
  }

  async function saveEditModal() {
    if (!editingSession) return;
    const payload = {
      employee_id: editValues.employee_id || null,
      remark: editValues.remark || null,
      start_time: editValues.start_time || null,
      end_time: editValues.end_time || null
    };
    try {
      await updateSession(editingSession.cs_id, payload);
      setEditOpen(false);
      setEditingSession(null);
    } catch (err) {
      // handled in updateSession
    }
  }

  /* ------------- Pivot helpers & render ------------- */

  function buildPivot(rows) {
    const pivot = {};
    const rowKeysSet = new Set();
    for (const s of rows) {
      const std = s.std_name || s.std_id || "All";
      const div = s.division_name || s.div_id || "";
      const rowKey = div ? `${std} / ${div}` : `${std}`;
      rowKeysSet.add(rowKey);

      let colKey = "Unk";
      if (s.period_no) colKey = `P${s.period_no}`;
      else if (s.start_time && s.end_time) colKey = `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`;

      if (!pivot[rowKey]) pivot[rowKey] = {};
      if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = [];
      pivot[rowKey][colKey].push(s);
    }
    const rowKeys = Array.from(rowKeysSet).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
    return { pivot, rowKeys };
  }

  function openAttendanceForSession(s) {
    const pref = {
      school_class_id: `${s.school_id || ""}:${s.medium_id || ""}:${s.std_id || ""}:${s.div_id || ""}`,
      date: s.session_date ? String(s.session_date).slice(0,10) : ""
    };
    sessionStorage.setItem("sa_prefill", JSON.stringify(pref));
    location.hash = "#/student-attendance";
  }

  // render session card (compact)
  function renderSessionCard(s) {
    const keyForColor = colorBy === "school" ? s.school_id : s.employee_id;
    const bg = pastelColorFromKey(keyForColor);
    return (
      <div key={s.cs_id || `${s.school_id}-${s.std_id}-${s.div_id}-${s.session_date}-${s.period_no}`} className={`session-card ${compactMode ? "compact" : ""}`} style={{ background: bg, padding: compactMode ? "6px" : "10px", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: compactMode ? 13 : 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.period_no ? `P${s.period_no}` : (s.start_time && s.end_time ? `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}` : "Session")}
              <span style={{ marginLeft: 8, fontWeight: 500, color: "#0f172a", opacity: 0.85 }}>{s.employee_name || s.school_name}</span>
            </div>
            {s.remark && <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>{s.remark}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <button className="px-2 py-1" style={{ borderRadius: 6, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }} onClick={() => openAttendanceForSession(s)}>Attendance</button>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="px-2 py-1" style={{ borderRadius: 6, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }} onClick={() => openEditModal(s)}>Edit</button>
              <button className="px-2 py-1" style={{ borderRadius: 6, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", color: "#b91c1c" }} onClick={() => deleteSession(s.cs_id)}>Delete</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------- Export pivot -> PDF ------------- */

  async function exportPivotToPdf() {
    if (!pivotRef.current) { window.ui?.toast?.("Nothing to export", "warning"); return; }
    try {
      // temporarily expand grid for full rendering
      const node = pivotRef.current;
      // clone node to avoid mutating UI
      const clone = node.cloneNode(true);
      clone.style.width = "1200px";
      clone.style.background = "#ffffff";
      clone.style.padding = "18px";

      // inject a header for PDF
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.marginBottom = "12px";
      header.innerHTML = `<div style="font-weight:700;font-size:18px">Class Sessions — Pivot</div><div style="font-size:12px;color:#374151">Generated: ${new Date().toLocaleString()}</div>`;
      clone.insertBefore(header, clone.firstChild);

      document.body.appendChild(clone);
      await new Promise(res => setTimeout(res, 80)); // let styles stabilize

      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, imageTimeout: 7000 });
      document.body.removeChild(clone);

      const img = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      // compute image dims
      const props = pdf.getImageProperties(img);
      const imgW = props.width;
      const imgH = props.height;
      const ratio = imgH / imgW;
      const availW = pageWidth - margin * 2;
      const renderW = availW;
      const renderH = availW * ratio;
      pdf.addImage(img, "PNG", margin, margin, renderW, renderH);
      // footer
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 6, { align: "right" });
      pdf.save(`class_sessions_pivot_${new Date().toISOString().slice(0,10)}.pdf`);
      window.ui?.toast?.("Exported PDF", "success");
    } catch (err) {
      console.error("exportPivotToPdf", err);
      window.ui?.toast?.("Export failed", "danger");
    }
  }

  /* ------------- UI actions ------------- */

  async function handleLoadClick() {
    const q = { session_date: date, pageSize: 1000 };
    if (timetableId) q.timetable_id = timetableId;
    if (periodNo) q.period_no = Number(periodNo);
    if (schoolId) q.school_id = Number(schoolId);
    if (stdId) q.std_id = Number(stdId);
    if (divId) q.div_id = Number(divId);
    if (employeeId) q.employee_id = Number(employeeId);
    await fetchSessions(q);
  }

  async function handleCreateFromServer() {
    const payload = { timetable_id: timetableId || null, school_id: schoolId ? Number(schoolId) : null, std_id: stdId ? Number(stdId) : null, div_id: divId ? Number(divId) : null, employee_id: employeeId ? Number(employeeId) : null, session_date: date, period_no: periodNo ? Number(periodNo) : null };
    if (!payload.session_date) { window.ui?.toast?.("Pick a date", "warning"); return; }
    if (!payload.timetable_id && !payload.school_id && !payload.std_id && !payload.employee_id) {
      if (!confirm("No timetable_id, school, std or employee selected — this will attempt to create sessions for all accessible timetables. Continue?")) return;
    }
    try {
      const r = await createFromTimetableAPI(payload);
      const created = r?.data?.created_count ?? r?.created_count ?? 0;
      window.ui?.toast?.(`${created} sessions created`, "success");
      await fetchSessions({ session_date: date, pageSize: 1000 });
    } catch (err) {
      console.error("createFromTimetableAPI", err);
      window.ui?.toast?.("Create failed", "danger");
    }
  }

  async function handleCreateByWeekday() {
    if (!confirm("Create sessions from timetable entries for the weekday of the selected date (preset times)?")) return;
    await createSessionsFromTimetableByWeekday({ targetDate: date, school_id: schoolId || null, std_id: stdId || null, div_id: divId || null, employee_id: employeeId || null, usePresetTimes: true });
  }

  const { pivot, rowKeys } = buildPivot(sessions);

  /* ------------- RENDER ------------- */
  return (
    <main className="max-w-7xl mx-auto px-6 py-6" style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
      <style>{`
        /* Corporate look */
        .card { background:#fff; border:1px solid rgba(15,23,42,0.06); border-radius:10px; box-shadow: 0 6px 18px rgba(16,24,40,0.04); }
        .controls-row { display:flex; gap:12px; align-items:end; flex-wrap:wrap; }
        .control-item { min-width:160px; flex: 1 1 200px; }
        .btn { padding:8px 12px; border-radius:8px; border:1px solid rgba(15,23,42,0.08); background:#fff; cursor:pointer; }
        .btn-primary { background:#0ea5a4; color:#fff; border:none; }
        .btn-ghost { background:transparent; border:1px solid rgba(15,23,42,0.06); }
        .session-card { border:1px solid rgba(15,23,42,0.06); border-radius:8px; padding:10px; }
        .compact .session-card { padding:6px; box-shadow:none; border-radius:6px; }
        /* pivot grid */
        .pivot-grid { gap:0.6rem; align-items:stretch; }
        .pivot-grid .head { background:#f8fafc; padding:10px; border:1px solid rgba(15,23,42,0.06); font-weight:600; text-align:center; }
        .pivot-grid .cell { padding:10px; min-height:56px; }
        /* print */
        @media print {
          .no-print{ display:none !important }
          .card { box-shadow:none !important }
        }
      `}</style>

      <div className="card no-print" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Class Sessions</h2>
            <div style={{ color: "#6b7280", marginTop: 6 }}>Create and visualise sessions — compact pivot for printing, calendar for scheduling.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setMode("both")}>Both</button>
            <button className="btn btn-ghost" onClick={() => setMode("pivot")}>Pivot</button>
            <button className="btn btn-ghost" onClick={() => setMode("calendar")}>Calendar</button>
            <button className="btn btn-ghost" onClick={() => { setCompactMode(c => !c); }}>Toggle Compact</button>
            <button className="btn btn-primary" onClick={exportPivotToPdf}>Export Pivot → PDF</button>
          </div>
        </div>

        {/* single-line filters */}
        <div className="controls-row" style={{ marginTop: 8 }}>
          <div className="control-item"><FormField label="Date"><DateInput value={date} onChange={v => setDate(v)} /></FormField></div>
          <div className="control-item"><FormField label="Timetable ID"><TextInput placeholder="timetable_id (optional)" value={timetableId} onChange={v => setTimetableId(v)} /></FormField></div>
          <div className="control-item"><FormField label="Period"><TextInput type="number" placeholder="period_no" value={periodNo} onChange={v => setPeriodNo(v)} /></FormField></div>
          <div className="control-item"><FormField label="School"><Select value={schoolId} onChange={v => setSchoolId(v)} options={[{ value: "", label: "— any —" }, ...(schools || []).map(s => ({ value: s.school_id, label: s.school_name }))]} /></FormField></div>
          <div className="control-item"><FormField label="Std"><Select value={stdId} onChange={v => setStdId(v)} options={[{ value: "", label: "— any —" }, ...(standards || []).map(s => ({ value: s.std_id, label: s.std_name }))]} /></FormField></div>
          <div className="control-item"><FormField label="Div"><Select value={divId} onChange={v => setDivId(v)} options={[{ value: "", label: "— any —" }, ...(divisions || []).map(d => ({ value: d.div_id, label: d.division_name }))]} /></FormField></div>
          <div className="control-item"><FormField label="Employee"><Select value={employeeId} onChange={v => setEmployeeId(v)} options={[{ value: "", label: "— any —" }, ...(employees || []).map(e => ({ value: e.employee_id, label: e.full_name }))]} /></FormField></div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleLoadClick}>Load</button>
            <button className="btn" onClick={handleCreateFromServer}>Create from timetable (server)</button>
            <button className="btn" onClick={handleCreateByWeekday}>Create by weekday (preset times)</button>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Color by</div>
            <select value={colorBy} onChange={e => setColorBy(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
              <option value="school">School</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
        </div>
      </div>

      {/* content grid */}
      <div style={{ display: "grid", gridTemplateColumns: mode === "both" ? "1fr 460px" : "1fr", gap: 16 }}>
        {/* pivot */}
        {mode !== "calendar" && (
          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Pivot — Std / Div × Timings (Compact)</h4>

            {loading ? <div style={{ color: "#6b7280" }}>Loading…</div> : (
              rowKeys.length === 0 ? <div style={{ color: "#6b7280" }}>No sessions found</div> : (
                <div ref={pivotRef} style={{ overflowX: "auto" }}>
                  <div style={{ display: "inline-block", minWidth: Math.max(720, 240 + (columns.length * 220)) }}>
                    <div className="pivot-grid" style={{ display: "grid", gridTemplateColumns: `240px repeat(${columns.length || 1}, 1fr)` }}>
                      <div className="head">Std / Div</div>
                      {columns.map(col => <div className="head" key={col}>{col}</div>)}

                      {rowKeys.map(rk => (
                        <React.Fragment key={rk}>
                          <div className="cell" style={{ fontWeight: 600 }}>{rk}</div>
                          {columns.map(col => {
                            const cell = (pivot[rk] && pivot[rk][col]) ? pivot[rk][col] : [];
                            return (
                              <div className="cell" key={col} style={{ minHeight: 72 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {cell.length === 0 ? <div style={{ color: "#9ca3af" }}>—</div> : cell.map(s => renderSessionCard(s))}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* calendar */}
        {mode !== "pivot" && (
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>Calendar</h4>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin, dayGridPlugin, listPlugin]}
              initialView="timeGridWeek"
              nowIndicator
              firstDay={1}
              slotMinTime="07:30:00"
              slotMaxTime="18:30:00"
              allDaySlot={false}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,listWeek' }}
              navLinks
              businessHours={[{ daysOfWeek: [1,2,3,4,5,6], startTime: '08:00', endTime: '16:30' }]}
              events={sessions.map(s => {
                const ev = sessionToEvent(s);
                // color by school/teacher
                const keyForColor = colorBy === "school" ? s.school_id : s.employee_id;
                ev.backgroundColor = pastelColorFromKey(keyForColor);
                ev.borderColor = "rgba(15,23,42,0.06)";
                return ev;
              })}
              eventClick={(info) => {
                const s = info.event.extendedProps;
                const label = `${info.event.title}\nDate: ${s.session_date}\nPeriod: ${s.period_no || 'N/A'}\nSchool: ${s.school_name || s.school_id || ''}\nFaculty: ${s.employee_name || ''}`;
                if (confirm(`${label}\n\nOpen Student Attendance for this session?`)) {
                  const pref = {
                    school_class_id: `${s.school_id || ''}:${s.medium_id || ''}:${s.std_id || ''}:${s.div_id || ''}`,
                    date: s.session_date ? String(s.session_date).slice(0,10) : ''
                  };
                  sessionStorage.setItem('sa_prefill', JSON.stringify(pref));
                  location.hash = '#/student-attendance';
                }
              }}
              eventDidMount={(info) => {
                // append school small text
                const s = info.event.extendedProps;
                if (s && s.school_name) {
                  const el = info.el.querySelector(".fc-event-title");
                  if (el) {
                    const small = document.createElement("div");
                    small.style.fontSize = "0.75em";
                    small.style.opacity = "0.9";
                    small.textContent = s.school_name;
                    el.appendChild(small);
                  }
                }
              }}
              height="auto"
            />
            <div style={{ color: "#6b7280", marginTop: 10 }}>Click an event to open Student Attendance (prefills class/date)</div>
          </div>
        )}
      </div>

      {/* Edit Modal (simple in-file modal) */}
      {editOpen && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(2,6,23,0.45)", zIndex: 9999
        }}>
          <div style={{ width: 720, maxWidth: "95%", background: "#fff", borderRadius: 10, padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Edit Session</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FormField label="Employee">
                  <Select value={editValues.employee_id || ""} onChange={v => setEditValues(ev => ({ ...ev, employee_id: v }))} options={[{ value: "", label: "— none —" }, ...(employees || []).map(e => ({ value: e.employee_id, label: e.full_name }))]} />
                </FormField>
              </div>
              <div>
                <FormField label="Period">
                  <input type="text" readOnly value={editingSession?.period_no ? `P${editingSession.period_no}` : (editingSession?.start_time && editingSession?.end_time ? `${editingSession.start_time.slice(0,5)}-${editingSession.end_time.slice(0,5)}` : "")} className="form-control" />
                </FormField>
              </div>

              <div>
                <FormField label="Start time">
                  <input type="time" value={editValues.start_time ? editValues.start_time.slice(0,5) : ""} onChange={e => setEditValues(ev => ({ ...ev, start_time: e.target.value ? `${e.target.value}:00` : "" }))} className="form-control" />
                </FormField>
              </div>

              <div>
                <FormField label="End time">
                  <input type="time" value={editValues.end_time ? editValues.end_time.slice(0,5) : ""} onChange={e => setEditValues(ev => ({ ...ev, end_time: e.target.value ? `${e.target.value}:00` : "" }))} className="form-control" />
                </FormField>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <FormField label="Remark">
                  <TextInput value={editValues.remark || ""} onChange={v => setEditValues(ev => ({ ...ev, remark: v }))} />
                </FormField>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={() => { setEditOpen(false); setEditingSession(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditModal}>Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
