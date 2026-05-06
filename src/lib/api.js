// src/lib/api.js
// Fully reliable fetch wrapper — works with all backend routes from your app.

/* ------------------------------------------------------------------ */
/*  Query string builder                                              */
/* ------------------------------------------------------------------ */
function qs(obj) {
  obj = obj || {};
  const p = new URLSearchParams();
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val === undefined || val === null || val === "") return;
    if (Array.isArray(val)) {
      val.forEach(v => { if (v !== undefined && v !== null) p.append(key, v); });
    } else {
      p.append(key, val);
    }
  });
  const out = p.toString();
  return out ? "?" + out : "";
}

/* ------------------------------------------------------------------ */
/*  Cookie reader                                                      */
/* ------------------------------------------------------------------ */
function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

/* ------------------------------------------------------------------ */
/*  Token source                                                       */
/* ------------------------------------------------------------------ */
function getTokenFresh() {
  try {
    if (typeof window !== "undefined" && window.auth?.getToken) {
      const t = window.auth.getToken();
      if (t) return t;
    }
  } catch {}
  try { const t2 = localStorage.getItem("token"); if (t2) return t2; } catch {}
  return readCookie("token") || "";
}

/* ------------------------------------------------------------------ */
/*  JSON content‑type detection                                        */
/* ------------------------------------------------------------------ */
function isJsonResponse(resp) {
  try {
    const ct = resp.headers.get("content-type") || "";
    return ct.includes("application/json");
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/*  API base URL resolver                                              */
/* ------------------------------------------------------------------ */
function getApiBase() {
  try { if (window.CONFIG && window.CONFIG.API_BASE) return String(window.CONFIG.API_BASE); } catch {}
  try {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return String(meta.content);
  } catch {}
  try {
    if (location.hostname) {
      const host = location.hostname;
      if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:4000";
      return "https://api.ankvidhya.com";
    }
  } catch {}
  return "https://api.ankvidhya.com";
}

let warnedOnceNoToken = false;

/* ------------------------------------------------------------------ */
/*  Main request function                                              */
/* ------------------------------------------------------------------ */
export async function request(url, options = {}) {
  const method   = options.method || "GET";
  const body     = options.body;
  const query    = options.query || options.params;  // ← accepts both params and query
  const headers  = new Headers(options.headers || {});
  const background = !!options.background;
  const expect   = options.expect || "auto";
  const _retried = options._retried;

  const base  = getApiBase();
  const token = getTokenFresh();

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isForm && body !== undefined && typeof body !== "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if ((url.startsWith("/api/") || url.startsWith("http")) && !background && !warnedOnceNoToken) {
    console.warn("[api] No token available – 401 may occur");
    warnedOnceNoToken = true;
  }

  const fullUrl = url.startsWith("http") ? url : base + url;
  const finalUrl = fullUrl + qs(query);

  // Debug log only in localhost
  if (typeof location !== "undefined" && location.hostname === "localhost") {
    console.debug("[api]", method, finalUrl);
  }

  let response;
  try {
    response = await fetch(finalUrl, {
      method,
      headers,
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (networkErr) {
    const err = new Error("Network error");
    err.status = 0;
    err.data = { message: "Network error" };
    throw err;
  }

  const looksJson = expect === "json" || (expect === "auto" && isJsonResponse(response));

  if (!response.ok) {
    if (response.status === 401 && !_retried) {
      const fresh = getTokenFresh();
      if (fresh && fresh !== token) {
        return request(url, { ...options, _retried: true });
      }
    }

    let errPayload = null;
    if (looksJson) {
      try { errPayload = await response.json(); }
      catch { errPayload = { message: "Failed to parse JSON error" }; }
    } else {
      try { errPayload = { message: await response.text() }; }
      catch { errPayload = { message: response.statusText || "Unknown error" }; }
    }

    if (response.status === 401 && !background) {
      try { localStorage.removeItem("token"); } catch {}
      try { window.dispatchEvent(new CustomEvent("auth:expired", { detail: { message: errPayload?.message || "Session expired" }})); } catch {}
    }

    const err = new Error(errPayload?.message || response.statusText || "HTTP error");
    err.status = response.status;
    err.data = errPayload;
    throw err;
  }

  if (expect === "blob") return response.blob();

  if (looksJson) {
    try { return await response.json(); }
    catch { return null; }
  }

  try { return await response.text(); }
  catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  Download helper                                                    */
/* ------------------------------------------------------------------ */
export async function download(url, opts = {}) {
  const blob = await request(url, { method: "GET", query: opts.query, headers: opts.headers, expect: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = opts.filename || "download";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

/* ------------------------------------------------------------------ */
/*  Convenience wrappers (you can call these directly)                 */
/* ------------------------------------------------------------------ */
const get   = (url, opts) => request(url, { ...(opts || {}), method: "GET" });
const post  = (url, body, opts) => request(url, { ...(opts || {}), method: "POST", body });
const put   = (url, body, opts) => request(url, { ...(opts || {}), method: "PUT", body });
const patch = (url, body, opts) => request(url, { ...(opts || {}), method: "PATCH", body });
const del   = (url, opts) => request(url, { ...(opts || {}), method: "DELETE" });

/* ------------------------------------------------------------------ */
/*  Grouped API helpers – use these in your pages to avoid typos       */
/* ------------------------------------------------------------------ */
export const api = {
  request,
  download,
  get, post, put, patch, del,

  // background POST (doesn't show auth warning)
  background(url, body, opts) {
    return request(url, { ...(opts || {}), method: "POST", body, background: true });
  },

  // Dashboard
  dashboard: {
    summary:         () => get("/api/dashboard/summary"),
    ordersTrend:     (days) => get("/api/dashboard/orders/trends", { query: { days } }),
    geoStrength:     (level) => get("/api/dashboard/geo-strength", { query: { level } }),
    cashflow:        () => get("/api/dashboard/cashflow"),
    notifications:   (params) => get("/api/dashboard/notifications", { query: params }),
  },

  // Master data / lookups
  master: {
    lookups:         () => get("/api/master/lookups"),
    mediums:         () => get("/api/master/mediums"),
    standards:       () => get("/api/master/standards"),
    listTable:       (table, params) => get("/api/master", { query: { table, ...params } }),
  },

  // Leads
  leads: {
    lookups:         () => get("/api/leads/lookups"),
    list:            (params) => get("/api/leads", { query: params }),
    get:             (id) => get(`/api/leads/${id}`),
    create:          (body) => post("/api/leads", body),
    update:          (id, body) => put(`/api/leads/${id}`, body),
    patch:           (id, body) => patch(`/api/leads/${id}`, body),
    delete:          (id) => del(`/api/leads/${id}`),
    publicSubmit:    (body) => post("/api/leads/public", body),
  },

  // Orders
  orders: {
    list:            (params) => get("/api/orders", { query: params }),
    get:             (id, params) => get(`/api/orders/${id}`, { query: params }),  // include=items,strengths,requirements
    create:          (body) => post("/api/orders", body),
    update:          (id, body) => put(`/api/orders/${id}`, body),
    delete:          (id) => del(`/api/orders/${id}`),
    strengths:       (orderId, rows) => post(`/api/orders/${orderId}/strengths`, { strengths: rows }),
    generate:        (orderId) => post(`/api/orders/${orderId}/generate`),
    reprice:         (orderId) => post(`/api/orders/${orderId}/reprice`),
    confirm:         (orderId) => post(`/api/orders/${orderId}/confirm`),
    invoiceGenerate: (orderId) => post(`/api/orders/${orderId}/invoice/generate`),
    invoicePdf:      (invoiceId) => get(`/api/invoices/${invoiceId}/pdf`, { expect: "blob" }),
  },

  // Schools
  schools: {
    list:            (params) => get("/api/schools/schools", { query: params }),
    get:             (id) => get(`/api/schools/schools/${id}`),
    create:          (body) => post("/api/schools/schools", body),
    update:          (id, body) => put(`/api/schools/schools/${id}`, body),
    delete:          (id) => del(`/api/schools/schools/${id}`),
    exportCsv:       () => get("/api/schools/schools/export/csv"),
    exportXlsx:      () => get("/api/schools/schools/export/xlsx"),
    importCsv:       (formData) => post("/api/schools/schools/import", formData),
  },

  // Employees / Faculty
  employees: {
    list:            (params) => get("/api/employees", { query: params }),
    get:             (id) => get(`/api/employees/${id}`),
    create:          (body) => post("/api/employees", body),
    update:          (id, body) => put(`/api/employees/${id}`, body),
    delete:          (id) => del(`/api/employees/${id}`),
    exportCsv:       () => get("/api/employees/export/csv"),
    exportXlsx:      () => get("/api/employees/export/excel"),
    importCsv:       (formData) => post("/api/employees/import-csv", formData),
  },

  // Faculty Assignments
  facultyAssignments: {
    list:            (params) => get("/api/faculty-assignments", { query: params }),
    create:          (body) => post("/api/faculty-assignments", body),
    update:          (id, body) => put(`/api/faculty-assignments/${id}`, body),
    delete:          (id) => del(`/api/faculty-assignments/${id}`),
    exportCsv:       () => get("/api/faculty-assignments/export/csv"),
    importCsv:       (text) => post("/api/faculty-assignments/import-csv", { csv: text }),
    bulkInsert:      (data) => post("/api/faculty-assignments/bulk-insert", data),
    bulkUpsert:      (data) => post("/api/faculty-assignments/bulk-upsert", data),
  },

  // Timetables
  timetables: {
    list:            (params) => get("/api/timetables", { query: params }),
    create:          (body) => post("/api/timetables", body),
    update:          (id, body) => put(`/api/timetables/${id}`, body),
    exportCsv:       () => get("/api/timetables/export/csv"),
    importCsv:       (text) => post("/api/timetables/import/csv", { csv: text }),
  },

  // Class Sessions
  classSessions: {
    list:            (params) => get("/api/class-sessions", { query: params }),
    createFromTimetable: (body) => post("/api/class-sessions/from-timetable", body),
    bulkCreate:      (sessions) => post("/api/class-sessions/bulk", { sessions }),
    update:          (id, body) => put(`/api/class-sessions/${id}`, body),
    delete:          (id) => del(`/api/class-sessions/${id}`),
  },

  // Courses
  courses: {
    list:            (params) => get("/api/courses", { query: params }),
    create:          (body) => post("/api/courses", body),
    update:          (id, body) => put(`/api/courses/${id}`, body),
    delete:          (id) => del(`/api/courses/${id}`),
  },

  // Books
  books: {
    list:            (params) => get("/api/books", { query: params }),
    create:          (body) => post("/api/books", body),
    update:          (id, body) => put(`/api/books/${id}`, body),
    delete:          (id) => del(`/api/books/${id}`),
  },

  // Videos
  videos: {
    list:            (params) => get("/api/videos", { query: params }),
    create:          (body) => post("/api/videos", body),
    update:          (id, body) => put(`/api/videos/${id}`, body),
    delete:          (id) => del(`/api/videos/${id}`),
    importCsv:       (text) => post("/api/videos/import", { csv: text }),
  },

  // Chapters
  chapters: {
    list:            (params) => get("/api/chapters", { query: params }),
    create:          (body) => post("/api/chapters", body),
    update:          (id, body) => put(`/api/chapters/${id}`, body),
    delete:          (id) => del(`/api/chapters/${id}`),
  },

  // Strengths & Requirements (legacy order strengths still work)
  strengths: {
    listForOrder:    (orderId) => get(`/api/orders/${orderId}/strengths`),
  },

  // User profile (self‑service)
  me: {
    get:             () => get("/api/users/me"),
    update:          (body) => put("/api/users/me", body),
  },
};

export default api;