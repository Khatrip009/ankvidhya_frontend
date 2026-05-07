// src/components/Topbar.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import Sidebar from "./Sidebar";
import ProfileModal from "./ProfileModal";
import api from "../lib/api";

// ────────────────────────────── Custom Hooks ──────────────────────────────

/**
 * useNotifications
 * Fetches real notifications from /api/notifications and provides
 * mark-read / refresh functionality.
 */
function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/dashboard/notifications");
      // Adapt to your API response shape – common pattern:
      const data = res?.data?.data ?? res?.data ?? [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Notifications fetch error:", err);
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark one / many notifications as read
  const markAsRead = useCallback(async (ids) => {
    try {
      await api.put("/api/notifications/read", { ids: Array.isArray(ids) ? ids : [ids] });
    } catch (err) {
      console.warn("Failed to mark notifications as read", err);
    }
  }, []);

  // Clear all notifications (optional API call)
  const clearAll = useCallback(async () => {
    try {
      await api.delete("/api/notifications");
      setNotifications([]);
    } catch (err) {
      console.warn("Failed to clear notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Optional: refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 120_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    clearAll,
  };
}

/**
 * useTheme
 * Manages light/dark theme with localStorage & system preference.
 */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}

// ────────────────────────────── Main Component ─────────────────────────────

export default function Topbar({
  logoBox = "h-[120px] w-[120px] md:h-[140px] md:w-[140px]",
  logoImgClass = "w-full h-full object-contain",
}) {
  const auth = useAuth() || {};
  const { user, logout, setUser } = auth;
  const navigate = useNavigate();

  const { theme, toggleTheme } = useTheme();
  const {
    notifications,
    loading: notifLoading,
    error: notifError,
    markAsRead,
    clearAll,
  } = useNotifications();

  // ── Mobile drawer ──
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = () => {
    setMobileOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeMobile = () => {
    setMobileOpen(false);
    document.body.style.overflow = "";
  };

  // ── Search ──
  const [q, setQ] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchInputRef = useRef(null);

  const handleSearch = useCallback(
    (term) => {
      const clean = (term || "").trim();
      if (!clean) return;
      navigate(`/admin/inquiries?search=${encodeURIComponent(clean)}`);
      setQ("");
      setShowMobileSearch(false);
    },
    [navigate]
  );

  const onSearchSubmit = (e) => {
    e?.preventDefault();
    handleSearch(q);
  };

  // Focus search input when mobile search opens
  useEffect(() => {
    if (showMobileSearch) searchInputRef.current?.focus();
  }, [showMobileSearch]);

  // Global shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setShowMobileSearch(true);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Notifications ──
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleNotif = () => {
    setNotifOpen((prev) => !prev);
    // Mark all visible as read on opening (optional)
    if (!notifOpen) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length) markAsRead(unreadIds);
    }
  };

  // ── Profile ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const openProfileModal = () => {
    setProfileModalOpen(true);
    setProfileOpen(false);
  };
  const closeProfileModal = () => setProfileModalOpen(false);

  const handleLogout = () => {
    logout && logout();
    navigate("/login", { replace: true });
  };

  // ── Toast ──
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleProfileSaved = async () => {
    closeProfileModal();
    try {
      const res = await api.get("/api/auth/me");
      const me = res?.data?.data ?? res?.data ?? null;
      if (me && typeof setUser === "function") {
        setUser(me);
      }
      setToast({
        type: "success",
        message: "Profile updated successfully.",
      });
    } catch (err) {
      console.warn("Failed to refresh user after profile save", err);
      setToast({
        type: "error",
        message: "Profile saved, but refreshing session failed. Please reload.",
      });
    }
  };

  // ── Render Helpers ──
  const LogoImage = () => (
    <img
      src={theme === "dark" ? "/images/Ank_Logo_dark.jpg" : "/images/Ank_Logo.png"}
      alt="AnkVidhya"
      className={logoImgClass}
    />
  );

  return (
    <>
      {/* ==================== HEADER ==================== */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 md:h-20">
          {/* Left section */}
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile only) */}
            <button
              onClick={openMobile}
              className="md:hidden inline-flex items-center justify-center p-2 -ml-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Open sidebar menu"
            >
              <svg className="w-6 h-6 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo + brand name */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <div className={`${logoBox} flex-shrink-0`}>
                <LogoImage />
              </div>
              <span className="hidden sm:block text-slate-800 dark:text-slate-100 font-semibold text-xl whitespace-nowrap">
                AnkVidhya
              </span>
            </Link>

            {/* Desktop search bar */}
            <form
              onSubmit={onSearchSubmit}
              className="hidden md:flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 gap-2 ml-4"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" strokeWidth="1.5" />
              </svg>
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search schools, orders… (Ctrl+K)"
                className="bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 w-48 lg:w-64"
              />
              <button type="submit" className="hidden" />
            </form>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile search toggle */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Toggle search"
            >
              <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" strokeWidth="1.5" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={toggleNotif}
                className="relative p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              >
                <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Notifications
                    </h2>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAll}
                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-4 text-sm text-slate-500 text-center">
                        Loading…
                      </div>
                    ) : notifError ? (
                      <div className="p-4 text-sm text-rose-500 text-center">{notifError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-start gap-3 transition-colors ${
                            !n.read ? "bg-slate-50 dark:bg-slate-800" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {n.time || n.created_at}
                            </p>
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 mt-2 rounded-full bg-indigo-500 flex-shrink-0"></span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="User menu"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 flex items-center justify-center text-white text-sm font-semibold uppercase">
                  {(user?.username || user?.employee_name || "U")[0]}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-100 leading-tight">
                    {user?.username || user?.employee_name || "User"}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-300 leading-tight">
                    {user?.role_name || user?.role || "—"}
                  </span>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/profile");
                    }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    View profile
                  </button>

                  <button
                    onClick={openProfileModal}
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Edit profile
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Settings
                  </Link>

                  <div className="border-t border-slate-100 dark:border-slate-700" />

                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile search bar (shown under header) */}
        {showMobileSearch && (
          <div className="md:hidden px-4 pb-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
            <form onSubmit={onSearchSubmit} className="flex items-center bg-slate-50 dark:bg-slate-800 border rounded-lg px-3 py-2 gap-2">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" strokeWidth="1.5" />
              </svg>
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
              >
                Go
              </button>
            </form>
          </div>
        )}
      </header>

      {/* ==================== MOBILE SIDEBAR DRAWER ==================== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-800 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`${logoBox} flex-shrink-0`}>
                  <LogoImage />
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                    AnkVidhya
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Menu
                  </span>
                </div>
              </div>

              <button
                onClick={closeMobile}
                className="p-2 -mr-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <Sidebar className="w-full" onClose={closeMobile} />
            </div>
          </aside>
        </div>
      )}

      {/* ==================== PROFILE MODAL ==================== */}
      <ProfileModal
        open={profileModalOpen}
        onClose={closeProfileModal}
        initialUser={user}
        onSaved={handleProfileSaved}
      />

      {/* ==================== TOAST ==================== */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200"
            }`}
            role="status"
          >
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}