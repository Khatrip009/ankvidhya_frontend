// src/pages/timetables.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";

import {
  CreateBtn,
  PrimaryBtn,
  SecondaryBtn,
  FileUploadBtn,
  CancelBtn,
  DeleteBtn,
} from "../components/buttons.jsx";

import {
  FormField,
  TextInput,
  TextArea,
  Select,
  DateInput
} from "../components/input.jsx";
// add near the top of the file where other imports are
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Timetables page — school-wise pivot cards with inline cell editor
 * (existing file logic kept; added font embedding and header fixes)
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 200;
const BULK_INSERT_URL = "/api/timetables/bulk/insert";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TODAY_ISO = (d = new Date()) => d.toISOString().slice(0,10);

/* ---------- FONT EMBEDDING CONFIG ----------
  To embed a custom font (so PDF text is selectable and uses that font):
  1. Convert the .ttf/.woff file to base64 (many online tools or CLI).
  2. Paste the base64 string below into EMBED_FONT.base64 (very long string).
  3. Set EMBED_FONT.fileName to the original filename (e.g. "Poppins-Regular.ttf").
  4. The script will call pdf.addFileToVFS + pdf.addFont for you.
*/
const EMBED_FONT = {
  enabled: false,               // set to true if you've filled base64
  base64: null,                 // <-- PASTE your font base64 string here (WITHOUT data:... header)
  fileName: "CustomFont-Regular.ttf", // filename to register in jsPDF VFS
  fontName: "CustomFont",       // internal font family name you'll use in setFont()
  fontStyle: "normal"           // "normal" | "bold" etc. (must match font binary)
};
/* -------------------------------------------- */

/* ---------- Single-line card size control ---------- */
const CARD_COLS = 1;

function dayNameToNumber(name) {
  if (!name) return null;
  const m = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  return m[String(name).trim().toLowerCase()] || null;
}

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseRow = (line) => {
    const out = []; let cur = ''; let q=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (ch === '"'){ if(q && line[i+1]==='"'){cur+='"'; i++; continue;} q=!q; continue; }
      if (!q && ch === ','){ out.push(cur); cur=''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseRow(lines[0]).map(h=>h.trim().toLowerCase());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = parseRow(lines[i]);
    const obj = {};
    for (let j=0;j<headers.length;j++) obj[headers[j]] = (cols[j] ?? '').trim();
    rows.push(obj);
  }
  return rows;
}

export default function TimetablesPage() {
  // lookups & masters
  const [schools, setSchools] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [employees, setEmployees] = useState([]);

  // filters & paging
  const [filters, setFilters] = useState({ search: "", school_id: "", medium_id: "", std_id: "", div_id: "", employee_id: "" });
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // timetables data (flat), grouped by school for cards
  const [rows, setRows] = useState([]);
  const [groupedBySchool, setGroupedBySchool] = useState([]); // array [{ school_id, school_name, pivot, rowKeys, logo }]
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // inline editing state
  const [editingCell, setEditingCell] = useState(null);
  const [editorValues, setEditorValues] = useState({ period_no: "", employee_id: "", remark: "" });

  // UI
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [
          sList,
          mList,
          stList,
          dList,
          empList
        ] = await Promise.all([
          api.get("/api/schools/schools", { query: { pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/master", { query: { table: "media", pageSize: 1000 } }).then(r => r?.data || []),
          api.get("/api/master", { query: { table: "standards", pageSize: 1000 } }).then(r => r?.data || []),
          api.get("/api/master", { query: { table: "divisions", pageSize: 1000 } }).then(r => r?.data || []),
          api.get("/api/employees", { query: { pageSize: 500 } }).then(r => r?.data || []),
        ]);

        setSchools(sList || []);
        setMediums(mList || []);
        setStandards(stList || []);
        setDivisions(dList || []);
        setEmployees(empList || []);

        // initial timetables
        await refreshTimetables(1, pageSize, filters);
      } catch (err) {
        console.error("init load", err);
        window.ui?.toast?.(err?.message || "Failed to load lookups", "danger");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTimetables({ page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, filters = {} } = {}) {
    const q = {
      page, pageSize,
      search: filters.search || "",
      school_name: filters.school_id ? (schools.find(s => String(s.school_id) === String(filters.school_id))?.school_name || "") : "",
      std_name: filters.std_id ? (standards.find(s => String(s.std_id) === String(filters.std_id))?.std_name || "") : "",
      employee_name: filters.employee_id ? (employees.find(e => String(e.employee_id) === String(filters.employee_id))?.full_name || "") : ""
    };
    const res = await api.get("/api/timetables", { query: q });
    return { data: res?.data || [], pagination: res?.pagination || { page, pageSize, total: 0 } };
  }

  async function refreshTimetables(p = 1, ps = pageSize, f = filters) {
    setLoading(true);
    try {
      const out = await fetchTimetables({ page: p, pageSize: ps, filters: f });
      const data = out.data || [];
      setRows(data);
      setTotal(out.pagination?.total || data.length);
      setPage(out.pagination?.page || p);
      setPageSize(out.pagination?.pageSize || ps);

      // group into school-wise pivot
      const schoolMap = new Map();
      for (const r of data) {
        const sid = r.school_id || `s_unknown_${r.school_name || "unknown"}`;
        const sname = r.school_name || "Unknown School";
        if (!schoolMap.has(sid)) {
          schoolMap.set(sid, { school_id: sid, school_name: sname, entries: [] });
        }
        schoolMap.get(sid).entries.push(r);
      }

      const grouped = [];
      for (const [sid, obj] of schoolMap.entries()) {
        const pivot = {};
        const rowKeysSet = new Set();

        for (const e of obj.entries) {
          const std = e.std_name || "All";
          const div = e.division_name || "";
          const rowKey = div ? `${std} / ${div}` : `${std}`;
          rowKeysSet.add(rowKey);
          const dayIndex = (Number(e.day_of_week) || dayNameToNumber(e.day_of_week) || null);
          const di = dayIndex || 0;

          if (!pivot[rowKey]) pivot[rowKey] = {};
          if (!pivot[rowKey][di]) pivot[rowKey][di] = [];
          pivot[rowKey][di].push({
            timetable_id: e.timetable_id,
            period_no: e.period_no,
            employee_name: e.employee_name,
            employee_id: e.employee_id ?? null,
            medium_name: e.medium_name,
            remark: e.remark,
            std_name: e.std_name,
            division_name: e.division_name
          });
        }

        // sort per cell
        for (const rk of Object.keys(pivot)) {
          for (const k of Object.keys(pivot[rk])) {
            pivot[rk][k].sort((a,b) => {
              const pa = Number(a.period_no) || 0;
              const pb = Number(b.period_no) || 0;
              return pa - pb;
            });
          }
        }

        const schoolObj = (schools || []).find(s => String(s.school_id) === String(sid));
        const logo = (schoolObj && (schoolObj.logo || schoolObj.school_logo || schoolObj.image)) || "/images/ANK.png";

        grouped.push({
          school_id: sid,
          school_name: obj.school_name,
          pivot,
          rowKeys: Array.from(rowKeysSet).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })),
          logo
        });
      }

      setGroupedBySchool(grouped);
    } catch (err) {
      console.error("refreshTimetables", err);
      setRows([]);
      setGroupedBySchool([]);
      setTotal(0);
      window.ui?.toast?.(err?.message || "Failed to load timetables", "danger");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- CRUD helpers ---------- */
  async function createTimetable(payload) {
    const res = await api.post('/api/timetables', payload);
    return res?.data || {};
  }
  async function updateTimetable(id, payload) {
    const res = await api.put(`/api/timetables/${id}`, payload);
    return res?.data || {};
  }

  /* ---------- CSV import/export ---------- */
  async function handleExportCSV() {
    try {
      const query = new URLSearchParams({
        search: filters.search || '',
        school_name: filters.school_id ? (schools.find(x=>String(x.school_id)===String(filters.school_id))?.school_name || '') : '',
        std_name: filters.std_id ? (standards.find(x=>String(x.std_id)===String(filters.std_id))?.std_name || '') : '',
        employee_name: filters.employee_id ? (employees.find(x=>String(x.employee_id)===String(filters.employee_id))?.full_name || '') : ''
      });
      const url = "/api/timetables/export/csv?" + query.toString();
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      const u = URL.createObjectURL(blob);
      a.href = u;
      a.download = `timetables_${TODAY_ISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      window.ui?.toast?.("Export started", "success");
    } catch (err) {
      window.ui?.toast?.(err?.message || "Export failed", "danger");
    }
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImporting(true);
    try {
      const txt = await file.text();
      const parsed = parseCSVText(txt);
      if (!parsed.length) { window.ui?.toast?.("No rows found in CSV", "warning"); setImporting(false); return; }
      const ok = window.confirm ? window.confirm(`Import ${parsed.length} rows?`) : true;
      if (!ok) { setImporting(false); return; }
      await api.post("/api/timetables/import/csv", { csv: txt });
      window.ui?.toast?.("Import completed", "success");
      await refreshTimetables(1, pageSize, filters);
    } catch (err) {
      console.error("import", err);
      window.ui?.toast?.(err?.message || "Import failed", "danger");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ---------- PDF export helpers ---------- */

  // Build a header element (logo + school name) for PDF pages.
  // Fixed: header uses anchvidhya logo left (ank logo) and a responsive title area to avoid cutting.
function buildPdfHeaderElement(schoolName, logoSrc) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "16px";
  wrapper.style.padding = "16px 20px";
  wrapper.style.background = "linear-gradient(90deg,#0ea5a4 0%, #60a5fa 100%)";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.borderRadius = "12px";
  wrapper.style.minHeight = "92px";      // ensure enough vertical space for tall names
  wrapper.style.overflow = "visible";
  wrapper.style.boxShadow = "0 3px 14px rgba(16,24,40,0.06)";

  const img = document.createElement("img");
  // try the provided logo, fallback to common paths (user requested image/Ank_Logo.png)
  img.src = logoSrc || "/image/Ank_Logo.png" || "/images/Ank_Logo.png";
  img.style.width = "84px";
  img.style.height = "84px";
  img.style.objectFit = "contain";
  img.style.display = "block";
  img.style.background = "white";
  img.style.padding = "8px";
  img.style.borderRadius = "10px";
  img.style.flex = "0 0 auto";

  const titleWrap = document.createElement("div");
  titleWrap.style.display = "flex";
  titleWrap.style.flexDirection = "column";
  titleWrap.style.justifyContent = "center";
  titleWrap.style.flex = "1 1 auto";
  titleWrap.style.minWidth = "0"; // enables ellipsis/wrap properly inside flex

  const title = document.createElement("div");
  title.textContent = schoolName || "";
  title.style.fontSize = "24px";
  title.style.fontWeight = "700";
  title.style.color = "#ffffff";
  title.style.lineHeight = "1.05";
  title.style.overflow = "visible";
  title.style.wordBreak = "break-word";
  title.style.display = "-webkit-box";
  title.style.webkitLineClamp = "2"; // allow max 2 lines
  title.style.webkitBoxOrient = "vertical";
  title.style.maxHeight = "56px";
  title.className = "school-title";

  const sub = document.createElement("div");
  sub.textContent = `School Timetable`;
  sub.style.fontSize = "13px";
  sub.style.color = "rgba(255,255,255,0.95)";
  sub.style.marginTop = "6px";

  titleWrap.appendChild(title);
  titleWrap.appendChild(sub);

  wrapper.appendChild(img);
  wrapper.appendChild(titleWrap);

  return wrapper;
}

// Utility: wait for all images under node to load (or error)
function waitForImages(node, timeout = 9000) {
  const imgs = Array.from(node.querySelectorAll("img"));
  if (!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(img => new Promise(res => {
    if (img.complete) return res();
    const to = setTimeout(() => { img.onload = img.onerror = null; res(); }, timeout);
    img.onload = img.onerror = () => { clearTimeout(to); res(); };
  })));
}

// Helper: attempt to embed font into jsPDF instance if EMBED_FONT configured
function tryEmbedFontIntoPdf(pdf) {
  try {
    if (!EMBED_FONT || !EMBED_FONT.enabled || !EMBED_FONT.base64) return false;
    // addFileToVFS expects base64 WITHOUT data: header
    pdf.addFileToVFS(EMBED_FONT.fileName, EMBED_FONT.base64);
    pdf.addFont(EMBED_FONT.fileName, EMBED_FONT.fontName, EMBED_FONT.fontStyle);
    // set the font globally for the pdf instance
    pdf.setFont(EMBED_FONT.fontName, EMBED_FONT.fontStyle);
    return true;
  } catch (err) {
    console.warn("Font embed failed:", err);
    return false;
  }
}

// Export one DOM card element to a jsPDF instance (landscape A4).
async function exportSingleCardToPdf(cardEl, schoolName, pdf, pageIndex = 0) {
  // clone and prepare container
  const clone = cardEl.cloneNode(true);

  // ensure export-school-name attribute exists
  clone.setAttribute("data-export-school-name", schoolName || clone.getAttribute("data-export-school-name") || (clone.querySelector(".school-title")?.textContent || ""));

  // Remove interactive elements (buttons, inputs, links) for clean PDF
  clone.querySelectorAll("button, input, select, textarea, a").forEach(el => {
    if (el.tagName.toLowerCase() === "a") {
      const span = document.createElement("span");
      span.textContent = el.textContent || "";
      el.parentNode.replaceChild(span, el);
    } else {
      el.remove();
    }
  });

  // create wrapper container sized for good raster quality
  const container = document.createElement("div");
  container.style.width = "1600px"; // wide for landscape A4 rendering
  container.style.background = "#ffffff";
  container.style.padding = "28px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "Poppins, Inter, Roboto, Arial, sans-serif";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "9999999";

  // inject a small <style> specifically for the cloned content to make PDF look polished
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
    .pdf-card { background: #ffffff; border-radius: 12px; box-shadow: 0 6px 18px rgba(16,24,40,0.06); padding: 18px; }
    .pdf-card .p-3 { padding: 12px; }
    .pdf-card .rounded-2xl { border-radius: 14px; }
    .pdf-card .border { border: 1px solid rgba(15,23,42,0.06); }
    .pdf-card .border-t { border-top: 1px solid rgba(15,23,42,0.06); }
    .pdf-table { width: 100%; border-collapse: separate; border-spacing: 8px; }
    .pdf-table .cell { background: #fff; border: 1px solid rgba(15,23,42,0.06); padding: 10px; border-radius: 8px; min-height: 44px; }
    .pdf-table .header-cell { background: rgba(99,102,241,0.06); font-weight:600; color: #111827; padding: 12px; border-radius: 8px; text-align:center; }
    .pdf-table .period-pill { display:inline-block; padding:6px 8px; border-radius:999px; background: rgba(99,102,241,0.12); font-weight:600; font-size:12px; margin-right:8px; }
    .pdf-card .school-title { font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto; letter-spacing: -0.4px; }
    .pdf-footer { display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:12px; color:#6b7280; }
    .pdf-meta { font-size:11px; color:#9ca3af; }
    /* ensure school-title wraps to two lines inside the header in the cloned DOM */
    .school-title { white-space:normal !important; overflow:visible !important; }
  `;
  container.appendChild(styleEl);

  // header + spacer + card (wrap in pdf-card)
  const header = buildPdfHeaderElement(schoolName, clone.querySelector("img")?.src || "/image/Ank_Logo.png");
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "pdf-card";
  wrapperDiv.appendChild(header);

  const spacer = document.createElement("div");
  spacer.style.height = "14px";
  wrapperDiv.appendChild(spacer);

  // ensure the card clone has consistent spacing classes for CSS above
  clone.style.marginTop = "8px";
  clone.style.background = "transparent";
  clone.classList.add("export-card-clone");
  wrapperDiv.appendChild(clone);

  // small footer meta inside the cloned DOM wrapper for visual completeness (will be captured in raster)
  const metaFooter = document.createElement("div");
  metaFooter.className = "pdf-footer";
  const left = document.createElement("div");
  left.textContent = `${schoolName || ""}`;
  left.className = "pdf-meta";
  const right = document.createElement("div");
  right.textContent = `Generated: ${new Date().toLocaleString()}`;
  right.className = "pdf-meta";
  metaFooter.appendChild(left);
  metaFooter.appendChild(right);
  wrapperDiv.appendChild(metaFooter);

  container.appendChild(wrapperDiv);
  document.body.appendChild(container);

  // wait for images inside container to load
  await waitForImages(container, 10000);

  // rasterize
  const canvas = await html2canvas(container, {
    scale: 2.5, // higher scale for crispness
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 9000
  });

  // remove container after canvas created
  document.body.removeChild(container);

  // embed into PDF (landscape A4)
  const imgData = canvas.toDataURL("image/png", 1.0);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // image original size
  const imgProps = pdf.getImageProperties(imgData);
  const imgW = imgProps.width;
  const imgH = imgProps.height;
  const ratio = imgH / imgW;

  // Render the image to fit width with small margins
  const margin = 10; // mm
  const availableW = pageWidth - margin * 2;
  const renderH = availableW * ratio;
  const renderW = availableW;
  const yPos = margin;

  if (pageIndex > 0) pdf.addPage();

  // if user provided an embedded font, attempt to register it for selectable text usage
  tryEmbedFontIntoPdf(pdf);

  // add image
  pdf.addImage(imgData, "PNG", margin, yPos, renderW, renderH);

  // draw page border (soft gray)
  pdf.setDrawColor(220, 224, 230);
  pdf.setLineWidth(0.6);
  pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);

  // footer: page number and generated timestamp (small)
  const footerText = `Page ${pageIndex + 1}`;
  pdf.setFontSize(9);
  pdf.setTextColor(113, 122, 133); // slate-400
  const footerY = pageHeight - 6;
  const footerX = pageWidth / 2;
  pdf.text(footerText, footerX, footerY, { align: "center" });

  // right-aligned timestamp
  const ts = new Date().toLocaleString();
  pdf.text(ts, pageWidth - margin, footerY, { align: "right" });

  return;
}

// Export all school cards present in DOM under a selector (one card per page)
async function exportAllCardsPdfFromDom(selector = "[data-export-school]") {
  try {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) { window.ui?.toast?.("No cards found to export", "warning"); return; }

    // create A4 landscape PDF
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

    // If EMBED_FONT configured and one-time embedding is desired, we try to attach it now:
    if (EMBED_FONT && EMBED_FONT.enabled && EMBED_FONT.base64) {
      // We add the font now to the instance (addFileToVFS/addFont must be called before using the font).
      try {
        pdf.addFileToVFS(EMBED_FONT.fileName, EMBED_FONT.base64);
        pdf.addFont(EMBED_FONT.fileName, EMBED_FONT.fontName, EMBED_FONT.fontStyle);
        // set the font to use for text stamps (page numbers) as well
        pdf.setFont(EMBED_FONT.fontName, EMBED_FONT.fontStyle);
      } catch (err) {
        console.warn("Font embedding in exportAll failed:", err);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const schoolId = node.getAttribute("data-export-school");
      const schoolName = node.getAttribute("data-export-school-name") || node.querySelector(".school-title")?.textContent?.trim() || `School ${schoolId}`;
      await exportSingleCardToPdf(node, schoolName, pdf, i);
    }

    const filename = `timetables_schools_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(filename);
    window.ui?.toast?.("Exported PDF (landscape)", "success");
  } catch (err) {
    console.error("exportAllCardsPdfFromDom:", err);
    window.ui?.toast?.(err?.message || "PDF export failed", "danger");
  }
}

// small alias so existing onClick handler works
const exportAllCardsPdf = exportAllCardsPdfFromDom;

 // Export a single card DOM (by school id attribute)
async function exportCardPdfBySchoolId(schoolId) {
  const selector = `[data-export-school="${String(schoolId)}"]`;
  const node = document.querySelector(selector);
  if (!node) { window.ui?.toast?.("Card not found", "warning"); return; }
  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

    // Try set embedded font for individual export
    if (EMBED_FONT && EMBED_FONT.enabled && EMBED_FONT.base64) {
      try {
        pdf.addFileToVFS(EMBED_FONT.fileName, EMBED_FONT.base64);
        pdf.addFont(EMBED_FONT.fileName, EMBED_FONT.fontName, EMBED_FONT.fontStyle);
        pdf.setFont(EMBED_FONT.fontName, EMBED_FONT.fontStyle);
      } catch (err) {
        console.warn("Font embedding failed for single export:", err);
      }
    }

    const schoolName = node.getAttribute("data-export-school-name") || node.querySelector(".school-title")?.textContent?.trim() || `School ${schoolId}`;
    await exportSingleCardToPdf(node, schoolName, pdf, 0);
    const fn = `timetable_${(schoolName||'school').replace(/\s+/g,'_')}.pdf`;
    pdf.save(fn);
    window.ui?.toast?.("Exported PDF (landscape)", "success");
  } catch (err) {
    console.error("exportCardPdfBySchoolId:", err);
    window.ui?.toast?.(err?.message || "PDF export failed", "danger");
  }
}


  /* ---------- Editor actions & rest of file (unchanged) ---------- */
  function openEditor(school_id, rowKey, dayIndex, existingEntry = null) {
    setEditingCell({ school_id, rowKey, dayIndex, existingEntry });
    setEditorValues({
      period_no: existingEntry?.period_no ?? "",
      employee_id: existingEntry?.employee_id ?? "",
      remark: existingEntry?.remark ?? ""
    });
    setTimeout(() => {
      if (editorRef.current) {
        const el = editorRef.current.querySelector('input[name="period_no"]');
        if (el) el.focus();
      }
    }, 50);
  }

  function closeEditor() {
    setEditingCell(null);
    setEditorValues({ period_no: "", employee_id: "", remark: "" });
  }

  async function saveEditor() {
    if (!editingCell) return;
    const { school_id, rowKey, dayIndex, existingEntry } = editingCell;
    let std_name = null, division_name = null;
    if (rowKey.includes('/')) {
      const [s, d] = rowKey.split('/').map(x => x.trim());
      std_name = s; division_name = d;
    } else {
      std_name = rowKey;
      division_name = null;
    }
    const schoolObj = schools.find(s => String(s.school_id) === String(school_id));
    const school_name = schoolObj?.school_name || "";

    const payload = {
      school_name,
      medium_name: null,
      std_name: std_name || null,
      division_name: division_name || null,
      employee_name: (employees.find(e => String(e.employee_id) === String(editorValues.employee_id))?.full_name) || editorValues.employee_id || null,
      day_of_week: Number(dayIndex) || null,
      period_no: editorValues.period_no === "" ? null : Number(editorValues.period_no),
      remark: editorValues.remark?.trim() || null
    };

    try {
      if (existingEntry && existingEntry.timetable_id) {
        await updateTimetable(existingEntry.timetable_id, payload);
        window.ui?.toast?.("Updated", "success");
      } else {
        await createTimetable(payload);
        window.ui?.toast?.("Created", "success");
      }
      closeEditor();
      await refreshTimetables(1, pageSize, filters);
    } catch (err) {
      console.error("save editor", err);
      window.ui?.toast?.(err?.message || "Save failed", "danger");
    }
  }

  function renderCellEntries(entries = [], school_id, rowKey, di) {
    if (!entries || !entries.length) {
      const isEditing = editingCell && editingCell.school_id === school_id && editingCell.rowKey === rowKey && editingCell.dayIndex === di;
      if (isEditing) return renderCellEditor(null, school_id, rowKey, di);
      return (
        <div className="flex items-center justify-center h-full">
          <button className="text-xs text-slate-400 px-2 py-1 border rounded" onClick={() => openEditor(school_id, rowKey, di, null)}>—</button>
        </div>
      );
    }

    const first = entries[0];
    const isEditing = editingCell && editingCell.school_id === school_id && editingCell.rowKey === rowKey && editingCell.dayIndex === di;
    if (isEditing) return renderCellEditor(first, school_id, rowKey, di);

    return (
      <div>
        {entries.map((en, idx) => (
          <div key={idx} className="mb-1 p-2 rounded border bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold">P{en.period_no ?? "—"} {en.employee_name ? `• ${en.employee_name}` : ""}</div>
              <div className="flex gap-1">
                <button className="text-[11px] px-2 py-0.5 border rounded" onClick={() => openEditor(school_id, rowKey, di, en)}>Edit</button>
              </div>
            </div>
            {en.remark && <div className="text-[11px] text-slate-500 italic truncate" title={en.remark}>{en.remark}</div>}
          </div>
        ))}
      </div>
    );
  }

  function renderCellEditor(existingEntry, school_id, rowKey, di) {
    return (
      <div ref={editorRef} className="p-2 rounded border bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <input
            name="period_no"
            type="number"
            min="1"
            className="text-xs w-[64px] p-1 border rounded"
            placeholder="Period"
            value={editorValues.period_no ?? ""}
            onChange={(e) => setEditorValues(v => ({ ...v, period_no: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
          />
          <select
            className="text-xs p-1 border rounded"
            value={editorValues.employee_id ?? ""}
            onChange={(e) => setEditorValues(v => ({ ...v, employee_id: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
          >
            <option value="">— select faculty —</option>
            {employees.map(emp => <option key={emp.employee_id} value={emp.employee_id}>{emp.full_name}</option>)}
          </select>
          <input
            type="text"
            className="text-xs flex-1 p-1 border rounded"
            placeholder="Remark"
            value={editorValues.remark ?? ""}
            onChange={(e) => setEditorValues(v => ({ ...v, remark: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
          />
          <div className="flex gap-1">
            <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded" onClick={saveEditor}>Save</button>
            <button className="text-xs px-2 py-1 border rounded" onClick={closeEditor}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function renderControls() {
    return (
      <div className="flex items-center gap-2">
        <a className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border" href="/api/timetables/export/csv" onClick={(e)=>{ e.preventDefault(); handleExportCSV(); }}>
          <i className="bi bi-filetype-csv" /> Export CSV
        </a>

        <label className="inline-flex items-center px-3 py-1.5 rounded-md border cursor-pointer">
          Import CSV
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => handleImportFile(e.target.files && e.target.files[0])} />
        </label>

        <PrimaryBtn onClick={() => refreshTimetables(1, pageSize, filters)}>Refresh</PrimaryBtn>
        <CreateBtn onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      </div>
    );
  }

  function renderSkeleton() {
    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: `repeat(${Math.max(1, CARD_COLS)}, minmax(0,1fr))` }}>
        {[1,2,3].map(i => (
          <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/2 mb-3"></div>
            <div className="h-40 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  function renderSchoolCard(school) {
    const { school_name, pivot, rowKeys, logo } = school;
    return (
          <div
            key={school.school_id}
            data-export-school={school.school_id}
            data-export-school-name={school_name} // added explicit name
            className="bg-white border rounded-2xl shadow-sm overflow-hidden transform transition hover:-translate-y-1 motion-reduce:transform-none"
          >
        <div className="p-4 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-md overflow-hidden bg-white flex-shrink-0 border">
              <img src={logo || "/images/ANK.png"} alt={school_name} className="h-full w-full object-contain" onError={(e)=>{ e.currentTarget.src = "/images/ANK.png"; }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate school-title">{school_name}</div>
              <div className="text-xs text-slate-500 truncate">{rowKeys.length} class row(s)</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">School ID: {String(school.school_id)}</div>
        </div>

        <div className="p-3 overflow-x-auto">
          <div className="inline-block min-w-[720px]">
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(7, 1fr)`, gap: "0.5rem", alignItems: "center" }}>
              <div className="px-2 py-2 font-medium text-sm border rounded-l-lg bg-slate-50">Std / Div</div>
              {DAYS.map((d, i) => (
                <div key={d} className="px-2 py-2 text-center font-medium text-sm border bg-slate-50">{d}</div>
              ))}
            </div>

            <div>
              {rowKeys.length === 0 && (
                <div className="mt-3 text-sm text-slate-500">No class rows for this school.</div>
              )}
              {rowKeys.map(rk => (
                <div key={rk} className="grid" style={{ gridTemplateColumns: `200px repeat(7, 1fr)`, gap: "0.5rem", alignItems: "start", marginTop: "0.5rem" }}>
                  <div className="px-2 py-2 font-medium text-sm border-l border-t border-b rounded-l-md bg-white">{rk}</div>
                  {Array.from({ length: 7 }).map((_, diIdx) => {
                    const di = diIdx + 1;
                    const cell = (pivot[rk] && pivot[rk][di]) ? pivot[rk][di] : [];
                    return (
                      <div key={di} className="px-2 py-2 border rounded-md bg-white min-h-[48px]">
                        {renderCellEntries(cell, school.school_id, rk, di)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t flex items-center justify-between text-xs text-slate-500">
          <div>{/* reserved for small footer text */}</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded border text-xs" onClick={() => {
              const q = new URLSearchParams({ school_name });
              const url = "/api/timetables/export/csv?" + q.toString();
              window.open(url, "_blank");
            }}>Export school CSV</button>
            <button className="px-2 py-1 rounded border text-xs" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); }}>Top</button>
          </div>
                    <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded border text-xs" onClick={() => {
              const q = new URLSearchParams({ school_name });
              const url = "/api/timetables/export/csv?" + q.toString();
              window.open(url, "_blank");
            }}>Export school CSV</button>

            {/* EXPORT PDF BUTTON */}
            <button className="px-2 py-1 rounded border text-xs" onClick={() => exportCardPdfBySchoolId(school.school_id)}>Export PDF</button>

            <button className="px-2 py-1 rounded border text-xs" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); }}>Top</button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" style={{ fontFamily: "Poppins, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');`}</style>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">School Timetables — Pivot Cards</h1>
          <div className="text-sm text-slate-500">Click any box to assign/edit period & faculty.</div>
        </div>
        <button className="px-3 py-1.5 rounded-md border" onClick={() => exportAllCardsPdf()}>Export All Cards (PDF)</button>

        <div className="flex items-center gap-2">
          {renderControls()}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-3">
            <FormField label="Search">
              <TextInput placeholder="school, medium, std, employee..." value={filters.search} onChange={(v) => { setFilters(f => ({ ...f, search: v })); setPage(1); refreshTimetables(1, pageSize, { ...filters, search: v }); }} />
            </FormField>
          </div>

          <div>
            <FormField label="School">
              <Select value={filters.school_id} onChange={(v) => { setFilters(f=>({...f, school_id: v})); setPage(1); refreshTimetables(1, pageSize, { ...filters, school_id: v }); }} options={[{ value: "", label: "All" }, ...(schools || []).map(s => ({ value: s.school_id, label: s.school_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Medium">
              <Select value={filters.medium_id} onChange={(v) => { setFilters(f=>({...f, medium_id: v})); setPage(1); refreshTimetables(1, pageSize, { ...filters, medium_id: v }); }} options={[{ value: "", label: "All" }, ...(mediums || []).map(m => ({ value: m.medium_id || m.medium_name, label: m.medium_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Std">
              <Select value={filters.std_id} onChange={(v) => { setFilters(f=>({...f, std_id: v})); setPage(1); refreshTimetables(1, pageSize, { ...filters, std_id: v }); }} options={[{ value: "", label: "All" }, ...(standards || []).map(s => ({ value: s.std_id, label: s.std_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Page Size">
              <Select value={pageSize} onChange={(v) => { setPageSize(Number(v)); setPage(1); refreshTimetables(1, Number(v), filters); }} options={[{ value: 100, label: "100" }, { value: 200, label: "200" }, { value: 500, label: "500" }]} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: `repeat(${Math.max(1, CARD_COLS)}, minmax(0,1fr))` }}>
        {loading && renderSkeleton()}

        {!loading && groupedBySchool.length === 0 && (
          <div className="col-span-full p-6 text-center text-slate-500">No timetable cards found</div>
        )}

        {!loading && groupedBySchool.map(renderSchoolCard)}
      </div>

      {/* Pager controls */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-slate-500">Showing page {page} — {total} result(s)</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded border" onClick={() => { if (page>1) { setPage(p=>p-1); refreshTimetables(page-1, pageSize, filters); } }} disabled={page<=1}>Prev</button>
          <button className="px-3 py-1 rounded border" onClick={() => { setPage(p=>p+1); refreshTimetables(page+1, pageSize, filters); }}>Next</button>
        </div>
      </div>
    </main>
  );
}
