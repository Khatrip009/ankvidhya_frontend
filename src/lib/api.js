// =====================================================
// src/lib/api.js
// Robust fetch wrapper — updated for GitHub Pages + Production backend
// =====================================================

/* Build query string */
function qs(obj) {
  obj = obj || {};
  var params = new URLSearchParams();
  Object.keys(obj).forEach(function (key) {
    var val = obj[key];
    if (val === undefined || val === null || val === "") return;
    if (Array.isArray(val)) {
      val.forEach(function (v) {
        if (v !== undefined && v !== null) params.append(key, v);
      });
    } else {
      params.append(key, val);
    }
  });
  var out = params.toString();
  return out ? "?" + out : "";
}

/* Read cookie */
function readCookie(name) {
  try {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch (e) {
    return "";
  }
}

/* Token source: window.auth > localStorage > cookie */
function getTokenFresh() {
  try {
    if (typeof window !== "undefined" && window.auth && typeof window.auth.getToken === "function") {
      var t = window.auth.getToken();
      if (t) return t;
    }
  } catch (e) {}

  try {
    var t2 = localStorage.getItem("token");
    if (t2) return t2;
  } catch (e) {}

  return readCookie("token") || "";
}

/* Detect JSON */
function isJsonResponse(resp) {
  try {
    var ct = (resp.headers && resp.headers.get("content-type")) || "";
    return ct.indexOf("application/json") !== -1;
  } catch (e) {
    return false;
  }
}

/* =====================================================
   FIXED: getApiBase()
   Logic:
   1) window.CONFIG.API_BASE → manual override
   2) meta[name="api-base"]
   3) localhost → http://127.0.0.1:4000
   4) ANY production host (GitHub Pages) → https://api.ankvidhya.com
   ===================================================== */
function getApiBase() {
  try {
    if (typeof window !== "undefined" && window.CONFIG && window.CONFIG.API_BASE) {
      return String(window.CONFIG.API_BASE);
    }
  } catch (e) {}

  try {
    if (typeof document !== "undefined") {
      var meta = document.querySelector('meta[name="api-base"]');
      if (meta && meta.content) return String(meta.content);
    }
  } catch (e) {}

  try {
    if (typeof location !== "undefined" && location.hostname) {
      var host = location.hostname;

      // Localhost environment
      if (host === "localhost" || host === "127.0.0.1") {
        return "http://127.0.0.1:4000";
      }

      // Production auto-detect
      return "https://api.ankvidhya.com";
    }
  } catch (e) {}

  return "https://api.ankvidhya.com"; // fallback
}

var warnedOnceNoToken = false;

/* MAIN REQUEST FUNCTION */
export async function request(url, options) {
  options = options || {};
  var method = options.method || "GET";
  var body = options.body;
  var query = options.query;
  var headers = options.headers || {};
  var background = !!options.background;
  var expect = options.expect || "auto";
  var _retried = options._retried;

  var base = getApiBase();
  var token = getTokenFresh();
  var headersObj = new Headers(headers || {});
  var isForm = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isForm && body !== undefined && typeof body !== "string" && !headersObj.has("Content-Type")) {
    headersObj.set("Content-Type", "application/json");
  }

  if (!headersObj.has("Accept")) {
    headersObj.set("Accept", "application/json, text/plain, */*");
  }

  if (token) {
    headersObj.set("Authorization", "Bearer " + token);
  } else if ((url.indexOf("/api/") === 0 || url.indexOf("http") === 0) && !background && !warnedOnceNoToken) {
    try { console.warn("[api] No token available. API calls may return 401."); } catch (e) {}
    warnedOnceNoToken = true;
  }

  var fullUrl = url.indexOf("http") === 0 ? url : base + url;
  var finalUrl = fullUrl + qs(query);

  var response;
  try {
    response = await fetch(finalUrl, {
      method: method,
      headers: headersObj,
      body:
        body === undefined
          ? undefined
          : isForm || typeof body === "string"
          ? body
          : JSON.stringify(body),
    });
  } catch (networkErr) {
    var errNet = new Error("Network error");
    errNet.status = 0;
    errNet.data = { message: "Network error" };
    throw errNet;
  }

  var looksJson = expect === "json" || (expect === "auto" && isJsonResponse(response));

  if (!response.ok) {
    if (response.status === 401 && !_retried) {
      var fresh = getTokenFresh();
      if (fresh && fresh !== token) {
        return request(url, { method, body, query, headers, background, expect, _retried: true });
      }
    }

    var errPayload = null;
    if (looksJson) {
      try {
        errPayload = await response.json();
      } catch (e) {
        errPayload = { message: "Failed to parse JSON error response" };
      }
    } else {
      try {
        errPayload = { message: await response.text() };
      } catch (e) {
        errPayload = { message: response.statusText || "Unknown error" };
      }
    }

    if (response.status === 401 && !background) {
      try { if (window.auth?.setToken) window.auth.setToken(""); } catch (e) {}
      try { localStorage.removeItem("token"); } catch (e) {}

      try {
        if (typeof window !== "undefined") {
          var ev = new CustomEvent("auth:expired", {
            detail: { message: errPayload?.message || "Session expired" }
          });
          window.dispatchEvent(ev);
        }
      } catch (e) {}
    }

    var err = new Error(errPayload?.message || response.statusText || "HTTP error");
    err.status = response.status;
    err.data = errPayload;
    throw err;
  }

  if (expect === "blob") return response.blob();

  if (looksJson) {
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  try {
    return await response.text();
  } catch (e) {
    return null;
  }
}

/* FILE DOWNLOAD SUPPORT */
export async function download(url, opts) {
  opts = opts || {};
  var blob = await request(url, { method: "GET", query: opts.query, headers: opts.headers, expect: "blob" });
  var link = document.createElement("a");
  var href = URL.createObjectURL(blob);
  link.href = href;
  link.download = opts.filename || "download";
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(href);
    try { link.remove(); } catch (e) {}
  }, 0);
}

/* Simple wrappers */
var get = (url, opts) => request(url, { ...(opts || {}), method: "GET" });
var post = (url, body, opts) => request(url, { ...(opts || {}), method: "POST", body });
var put = (url, body, opts) => request(url, { ...(opts || {}), method: "PUT", body });
var patch = (url, body, opts) => request(url, { ...(opts || {}), method: "PATCH", body });
var del = (url, opts) => request(url, { ...(opts || {}), method: "DELETE" });

/* MAIN API */
export var api = {
  request, download,
  get, post, put, patch, del,

  background(url, body, opts) {
    return request(url, { ...(opts || {}), method: "POST", body, background: true });
  },

  leads: {
    lookups: () => get("/api/leads/lookups"),
    list: (params) => get("/api/leads", { query: params }),
    get: (id) => get("/api/leads/" + id),
    patch: (id, body) => patch("/api/leads/" + id, body),
    remove: (id) => del("/api/leads/" + id),
    convert: (id) => post("/api/leads/" + id + "/convert"),
    publicSubmit: (body) => post("/api/leads/public", body)
  },

  orders: {
    strengths: (orderId, rows) => post(`/api/orders/${orderId}/strengths`, { strengths: rows }),
    confirm: (orderId) => post(`/api/orders/${orderId}/confirm`)
  }
};

export default api;
