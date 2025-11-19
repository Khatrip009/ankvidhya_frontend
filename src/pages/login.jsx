// src/pages/Login.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import auth from "../lib/auth";

/**
 * Login page recreated from your legacy HTML + JS
 * - Tailwind-only styles (no external CSS files)
 * - Floating doodles, overlay, quote carousel, icons
 * - Calls api.post('/auth/login') and then auth.loadMe()
 *
 * After successful login it will inspect the user's role and navigate to:
 *  - /dashboard/admin    (admin-like roles)
 *  - /dashboard/faculty  (faculty)
 *  - /dashboard/school   (school / school_admin)
 *  - /dashboard          (fallback)
 *
 * This preserves RBAC/RLS because we hydrate session (auth.loadMe()) before navigation.
 */

const QUOTES = [
  { q: "Mathematics is the language with which God has written the universe.", a: "Galileo Galilei" },
  { q: "Education is not the learning of facts, but the training of the mind to think.", a: "Albert Einstein" },
  { q: "The only limit to our realization of tomorrow is our doubts of today.", a: "F. D. Roosevelt" },
  { q: "An investment in knowledge pays the best interest.", a: "Benjamin Franklin" },
  { q: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", a: "Benjamin Franklin" },
  { q: "The beautiful thing about learning is that no one can take it away from you.", a: "B. B. King" },
  { q: "Pure mathematics is, in its way, the poetry of logical ideas.", a: "Albert Einstein" },
  { q: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", a: "Malcolm X" },
  { q: "It always seems impossible until it’s done.", a: "Nelson Mandela" },
  { q: "The expert in anything was once a beginner.", a: "Helen Hayes" },
];

function decideDashboardByRole(roleRaw = "") {
  const role = (roleRaw || "").toString().toLowerCase();
  if (!role) return "/dashboard";
  // admin-like
  if (role.includes("admin") || role.includes("super") || role.includes("manager") || role.includes("owner")) return "/dashboard/admin";
  // faculty / teacher
  if (role.includes("faculty") || role.includes("teacher") || role.includes("instructor")) return "/dashboard/faculty";
  // school / school_admin
  if (role.includes("school") || role.includes("school_admin") || role.includes("schooladmin")) return "/dashboard/school";
  // default
  return "/dashboard";
}

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const quoteTimerRef = useRef(null);

  useEffect(() => {
    // Prefill remember-me
    try {
      const rem = localStorage.getItem("remember_identifier");
      if (rem) {
        setIdentifier(rem);
        setRemember(true);
      }
    } catch (e) {}

    // Auto-advance quotes
    quoteTimerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % QUOTES.length);
    }, 6000);

    return () => {
      clearInterval(quoteTimerRef.current);
    };
  }, []);

  function prevQuote() {
    setIdx((i) => (i - 1 + QUOTES.length) % QUOTES.length);
  }
  function nextQuote() {
    setIdx((i) => (i + 1) % QUOTES.length);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      const msg = "Please enter username/email and password";
      if (window.ui && window.ui.toast) window.ui.toast(msg, "danger");
      else alert(msg);
      return;
    }

    setBusy(true);
    try {
      // send login request
      const res = await api.post("/auth/login", {
        usernameOrEmail: identifier.trim(),
        password,
      });

      // extract token if present
      let token = null;
      if (res) {
        token = res.token || res.access_token || (res.data && (res.data.token || res.data.access_token)) || null;
      }

      // If token present, set it so subsequent calls include Authorization header
      if (token) {
        auth.setToken(token);
      }

      // Remember me persistence
      if (remember) localStorage.setItem("remember_identifier", identifier.trim());
      else localStorage.removeItem("remember_identifier");

      // Hydrate session: loadMe sets localStorage.user, role, permissions (and any RLS school_ids)
      let me = null;
      try {
        me = await auth.loadMe();
      } catch (e) {
        // If token was set but loadMe fails, try to read user from response bodies or fallback to cookie session
        console.warn("auth.loadMe failed after login:", e?.message || e);

        // Attempt alternative endpoints / shapes (best-effort)
        try {
          const alt = await api.get("/api/auth/me").catch(() => api.get("/auth/me"));
          me = (alt && (alt.data || alt)) || null;
          if (me) {
            // persist session locally (mirrors setSession)
            try { localStorage.setItem("user", JSON.stringify(me)); } catch {}
            try { localStorage.setItem("role", (me.role_name || me.role || "").toString().toLowerCase()); } catch {}
            if (me.permissions) try { localStorage.setItem("permissions", JSON.stringify(me.permissions)); } catch {}
          }
        } catch (xx) {
          // ignore
        }
      }

      // If me still not present but server returned user in res.data, pick it
      if (!me && res && res.data) {
        me = res.data;
        try { localStorage.setItem("user", JSON.stringify(me)); } catch {}
        try { localStorage.setItem("role", (me.role_name || me.role || "").toString().toLowerCase()); } catch {}
      }

      // At this point, if there is a loaded session, decide role and navigate accordingly.
      const roleFromMe = me ? (me.role_name || me.role || "") : (localStorage.getItem("role") || "");
      const target = decideDashboardByRole(roleFromMe);

      if (window.ui && window.ui.toast) window.ui.toast("Welcome!", "success");
      navigate(target, { replace: true });
    } catch (err) {
      console.error("Login error", err);
      if (err?.status === 401) {
        const msg = err?.data?.message || "Invalid credentials";
        if (window.ui && window.ui.toast) window.ui.toast(msg, "danger");
        else alert(msg);
      } else if (err?.status === 403) {
        const msg = "Signed in, but your role/scope is restricted. Contact admin.";
        if (window.ui && window.ui.toast) window.ui.toast(msg, "warning");
        else alert(msg);
      } else {
        const msg = err?.data?.message || err.message || "Login failed";
        if (window.ui && window.ui.toast) window.ui.toast(msg, "danger");
        else alert(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  // doodles positions
  const doodles = [
    { char: "π", x: "6%", y: "8%", size: "text-2xl", delay: "delay-0" },
    { char: "∞", x: "18%", y: "22%", size: "text-3xl", delay: "delay-200" },
    { char: "Σ", x: "32%", y: "6%", size: "text-2xl", delay: "delay-400" },
    { char: "√", x: "70%", y: "12%", size: "text-2xl", delay: "delay-600" },
    { char: "Δ", x: "82%", y: "32%", size: "text-3xl", delay: "delay-800" },
    { char: "∫", x: "56%", y: "40%", size: "text-2xl", delay: "delay-1000" },
    { char: "∮", x: "12%", y: "62%", size: "text-2xl", delay: "delay-1200" },
    { char: "Δ", x: "44%", y: "74%", size: "text-2xl", delay: "delay-1400" },
    { char: "∂", x: "74%", y: "66%", size: "text-2xl", delay: "delay-1600" },
    { char: "≈", x: "82%", y: "78%", size: "text-2xl", delay: "delay-1800" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-5xl w-full shadow-2xl rounded-2xl overflow-hidden bg-white grid grid-cols-1 md:grid-cols-2">
        {/* LEFT: Login form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="text-center mb-6">
            <img src="/images/Ank_Logo.png" alt="AnkVidhya Logo" className="mx-auto mb-3 h-16" />
            <h1 className="text-2xl font-semibold text-slate-800">Welcome to AnkVidhya ERP System</h1>
            <p className="mt-1 text-sm text-slate-500">Where Numbers Meet Life Wisdom</p>
          </div>

          <form id="loginForm" onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label className="sr-only" htmlFor="identifier">Email or Username</label>
              <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <div className="px-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A9 9 0 1118.879 6.196 9 9 0 015.121 17.804z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or Username"
                  className="w-full px-3 py-3 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="password">Password</label>
              <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <div className="px-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11v7a2 2 0 002 2h10a2 2 0 002-2v-7H5z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-3 outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-indigo-600 rounded"
                />
                <span className="text-slate-600">Remember me</span>
              </label>
              <button type="button" className="text-indigo-600 hover:underline text-sm" onClick={() => navigate("/forgot-password")}>
                Forgot password?
              </button>
            </div>

            <div>
              <button
                id="loginBtn"
                type="submit"
                disabled={busy}
                className={`w-full py-3 rounded-lg text-white font-medium transition-all ${busy ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <span>{busy ? "Signing in…" : "Sign in"}</span>
                  {busy && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: Quotes / Art Panel */}
        <div className="relative hidden md:flex flex-col justify-center items-center text-white p-8 md:p-12 bg-gradient-to-br from-indigo-700 via-fuchsia-700 to-rose-600 overflow-hidden">
          {/* floating doodles */}
          {doodles.map((d, i) => (
            <span
              key={i}
              aria-hidden
              style={{ left: d.x, top: d.y, transitionDelay: `${i * 120}ms` }}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 opacity-80 ${d.size} animate-[float_6s_ease-in-out_infinite]`}
            >
              {d.char}
            </span>
          ))}

          {/* dark overlay (soft) */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>

          <div className="relative z-10 w-full max-w-md text-center">
            {/* quote icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.17 6A5 5 0 107 16H9a3 3 0 013-3V6H7.17zM17.17 6A5 5 0 1017 16h2a3 3 0 00-3-3V6h1.17z" />
            </svg>

            <div id="quote-container" className="mb-4">
              <p className="text-lg font-medium leading-relaxed">{QUOTES[idx].q}</p>
              <p className="mt-2 text-sm opacity-80">— {QUOTES[idx].a}</p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-3">
              <button onClick={prevQuote} className="text-white/90 hover:text-white text-2xl p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="h-1 w-24 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${((idx + 1) / QUOTES.length) * 100}%` }}
                />
              </div>
              <button onClick={nextQuote} className="text-white/90 hover:text-white text-2xl p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tiny inline style for float animation (no external CSS file). Tailwind doesn't generate arbitrary keyframes by default,
          so we add a small <style> here. This is still "no external CSS file" per your request. */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0) rotate(0deg); }
          50% { transform: translateY(-8px) translateX(6px) rotate(4deg); }
          100% { transform: translateY(0) translateX(0) rotate(0deg); }
        }
        .animate-[float_6s_ease-in-out_infinite] {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
