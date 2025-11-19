// src/components/Topbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import Sidebar from "./Sidebar";
import ProfileModal from "./ProfileModal";
import api from "../lib/api";

export default function Topbar({
  logoBox = "h-[140px] w-[140px] md:h-[170px] md:w-[170px]",
  logoImgClass = "w-full h-full object-contain",
}) {
  // useAuth should at least expose { user, logout }; if setUser is available we'll use it.
  const auth = useAuth() || {};
  const { user, logout, setUser } = auth;
  const navigate = useNavigate();

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = () => {
    setMobileOpen(true);
    document.body.style.overflow = "hidden";
  };
  const closeMobile = () => {
    setMobileOpen(false);
    document.body.style.overflow = "";
  };

  // Search
  const [q, setQ] = useState("");
  const searchRef = useRef(null);
  const onSearchSubmit = (e) => {
    e && e.preventDefault();
    const term = (q || "").trim();
    if (!term) return;
    navigate(`/admin/inquiries?search=${encodeURIComponent(term)}`);
    setQ("");
  };

  // Notifications (UI only)
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "New inquiry from St. Mary's", time: "2m", unread: true },
    { id: 2, title: "Order #345 completed", time: "1h", unread: true },
    { id: 3, title: "Employee profile updated", time: "1d", unread: false },
  ]);

  const toggleNotif = () => {
    setNotifOpen((v) => !v);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, unread: false }))
    );
  };

  // Profile menu + modal
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

  // Theme
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const applyTheme = (t) => {
    try {
      if (t === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", t);
    } catch (e) {
      console.warn("Theme error", e);
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Search shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unread = notifications.filter((n) => n.unread).length;

  // Toast (success / error for profile refresh)
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Called AFTER ProfileForm saved, via ProfileModal -> Profile -> ProfilePage
  const handleProfileSaved = async () => {
    closeProfileModal();

    try {
      const res = await api.get("/api/auth/me");
      const me = res?.data?.data ? res.data.data : res?.data || null;

      if (me && typeof setUser === "function") {
        try {
          setUser(me);
        } catch (e) {
          console.warn("setUser threw", e);
        }
      }

      if (!me) {
        setToast({
          type: "error",
          message:
            "Profile saved, but failed to refresh logged-in user.",
        });
      } else {
        setToast({
          type: "success",
          message: "Profile updated successfully.",
        });
      }
    } catch (err) {
      console.warn("Failed to refresh /api/auth/me after profile save", err);
      setToast({
        type: "error",
        message:
          "Profile saved, but refreshing your session failed. Please reload the page.",
      });
    }
  };

  return (
    <>
      <header className="w-full bg-white dark:bg-slate-900 border-b">
        <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 h-20">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <button
              onClick={openMobile}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg
                className="h-7 w-7 text-slate-700 dark:text-slate-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Logo + brand */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <div className={`${logoBox} flex-shrink-0`}>
                <img
                  src={
                    theme === "dark"
                      ? "/images/Ank_Logo_dark.jpg"
                      : "/images/Ank_Logo.png"
                  }
                  alt="AnkVidhya"
                  className={logoImgClass}
                />
              </div>
              <span className="text-slate-800 dark:text-slate-100 font-semibold text-xl">
                AnkVidhya
              </span>
            </Link>

            {/* Desktop search */}
            <form
              onSubmit={onSearchSubmit}
              className="hidden md:flex items-center bg-slate-50 dark:bg-slate-800 border rounded px-2 py-1 gap-2"
            >
              <svg
                className="h-5 w-5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M21 21l-4.35-4.35"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="11" cy="11" r="6" strokeWidth="1.5" />
              </svg>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search leads, schools, orders..."
                className="bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 px-2 py-1 w-64"
              />
              <button type="submit" className="hidden" />
            </form>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile search trigger */}
            <button
              onClick={() => {
                const s = prompt("Search");
                if (s)
                  navigate(
                    `/admin/inquiries?search=${encodeURIComponent(s)}`
                  );
              }}
              className="md:hidden p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg
                className="h-6 w-6 text-slate-700 dark:text-slate-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 21l-4.35-4.35"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="11" cy="11" r="6" strokeWidth="1.5" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={toggleNotif}
                className="relative p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg
                  className="h-7 w-7 text-slate-700 dark:text-slate-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full px-1.5">
                    {unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border rounded shadow-lg z-50 overflow-hidden">
                  <div className="p-3 border-b text-sm font-medium text-slate-700 dark:text-slate-100">
                    Notifications
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {notifications.length === 0 && (
                      <div className="p-3 text-sm text-slate-500">
                        No notifications
                      </div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-start gap-3 ${
                          n.unread
                            ? "bg-slate-50 dark:bg-slate-700"
                            : ""
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-sm text-slate-800 dark:text-slate-100">
                            {n.title}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {n.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t text-center">
                    <button
                      onClick={() => {
                        setNotifications([]);
                        setNotifOpen(false);
                      }}
                      className="text-sm text-indigo-600"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              onClick={() =>
                setTheme((prev) => (prev === "dark" ? "light" : "dark"))
              }
              className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <svg
                  className="h-6 w-6 text-yellow-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 text-slate-700 dark:text-slate-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 flex items-center justify-center text-white text-sm font-semibold">
                  {(user?.username ||
                    user?.employee_name ||
                    "U")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-100">
                    {user?.username ||
                      user?.employee_name ||
                      "User"}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-300">
                    {user?.role_name || user?.role || "—"}
                  </span>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border rounded shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/profile");
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Profile
                  </button>

                  <button
                    onClick={openProfileModal}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Edit profile
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Settings
                  </Link>
                  <div className="border-t" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            onClick={closeMobile}
            className="fixed inset-0 bg-black/40"
          />
          <div className="relative bg-white dark:bg-slate-800 w-80 max-w-full h-full shadow-xl overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className={`${logoBox} flex-shrink-0`}>
                  <img
                    src={
                      theme === "dark"
                        ? "/images/Ank_Logo_dark.jpg"
                        : "/images/Ank_Logo.png"
                    }
                    alt="logo"
                    className={logoImgClass}
                  />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    AnkVidhya
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">
                    Menu
                  </div>
                </div>
              </div>

              <button
                onClick={closeMobile}
                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <svg
                  className="h-6 w-6 text-slate-700 dark:text-slate-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <Sidebar className="w-full" onClose={closeMobile} />
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal with initialUser + save handler */}
      <ProfileModal
        open={profileModalOpen}
        onClose={closeProfileModal}
        initialUser={user}
        onSaved={handleProfileSaved}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {toast.type === "success" ? (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
