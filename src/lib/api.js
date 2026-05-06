// src/lib/api.js
// Robust fetch wrapper — updated for GitHub Pages + Production backend

/* Build query string */
function qs(obj) {
  obj = obj || {};
  const params = new URLSearchParams();
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val === undefined || val === null || val === "") return;
    if (Array.isArray(val)) {
      val.forEach(v => { if (v !== undefined && v !== null) params.append(key, v); });
    } else {
      params.append(key, val);
    }
  });
  const out = params.toString();
  return out ? "?" + out : "";
}

/* Read cookie */
function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

/* Token source */
function getTokenFresh() {
  try {
    if (typeof window !== "undefined" && window.auth?.getToken) {
      const t = window.auth.getToken();
      if (t) return t;
    }
  } catch {}

  try {
    const t2 = localStorage.getItem("token");
    if (t2) return t2;
  } catch {}

  return readCookie("token") || "";
}

/* Detect JSON */
function isJsonResponse(resp) {
  try {
    const ct = resp.headers.get("content-type") || "";
    return ct.includes("application/json");
  } catch { return false; }
}

/* ================== API BASE ================== */
function getApiBase() {
  try {
    if (window.CONFIG && window.CONFIG.API_BASE) return String(window.CONFIG.API_BASE);
  } catch {}

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

/* ------------------ REQUEST ------------------ */
export async function request(url, options = {}) {
  const method   = options.method || "GET";
  const body     = options.body;
  const query    = options.query;
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

  // Debug log – only in development (can be removed in production)
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

/* Download wrapper */
export async function download(url, opts = {}) {
  const blob = await request(url, { method: "GET", query: opts.query, headers: opts.headers, expect: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = opts.filename || "download";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

/* Convenience methods */
const get   = (url, opts) => request(url, { ...(opts || {}), method: "GET" });
const post  = (url, body, opts) => request(url, { ...(opts || {}), method: "POST", body });
const put   = (url, body, opts) => request(url, { ...(opts || {}), method: "PUT", body });
const patch = (url, body, opts) => request(url, { ...(opts || {}), method: "PATCH", body });
const del   = (url, opts) => request(url, { ...(opts || {}), method: "DELETE" });

export const api = {
  request,
  download,
  get,
  post,
  put,
  patch,
  del,

  background(url, body, opts) {
    return request(url, { ...(opts || {}), method: "POST", body, background: true });
  },

  leads: {
    lookups: () => get("/api/leads/lookups"),
    list: (params) => get("/api/leads", { query: params }),
    get: (id) => get(`/api/leads/${id}`),
    patch: (id, body) => patch(`/api/leads/${id}`, body),
    remove: (id) => del(`/api/leads/${id}`),
    convert: (id) => post(`/api/leads/${id}/convert`),
    publicSubmit: (body) => post("/api/leads/public", body),
  },

  orders: {
    strengths: (orderId, rows) => post(`/api/orders/${orderId}/strengths`, { strengths: rows }),
    confirm: (orderId) => post(`/api/orders/${orderId}/confirm`),
  },
};

export default api;