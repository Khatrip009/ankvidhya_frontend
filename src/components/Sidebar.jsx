// src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import ERPIcons from "./icons.jsx";

// ---------- icon resolver ----------
function resolveIcon(name, className = "w-4 h-4") {
  const iconMap = {
    dashboard: ERPIcons.Dashboard,
    schools: ERPIcons.FolderOpen,
    inquiries: ERPIcons.Message,
    orders: ERPIcons.Order,
    strength: ERPIcons.Analytics,
    faculty: ERPIcons.Users,
    academics: ERPIcons.CalendarCheck,
    timetable: ERPIcons.CalendarPlus,
    classes: ERPIcons.Grid,
    courses: ERPIcons.File,
    books: ERPIcons.File,
    videos: ERPIcons.Play,
    reports: ERPIcons.Reports,
    "report-item": ERPIcons.File,
    settings: ERPIcons.Settings,
  };
  const IconComp = iconMap[name] || ERPIcons.Dashboard;
  return IconComp ? <IconComp className={className} aria-hidden="true" /> : null;
}

// ---------- NavLink ----------
function NavLink({ to, children, indent = false, iconName, onClick, className = "" }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium
        transition-colors duration-150
        ${indent ? "pl-10" : "pl-2"}
        ${
          active
            ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-900/20 dark:text-indigo-300"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        }
        ${className}
      `}
      aria-current={active ? "page" : undefined}
    >
      {iconName && (
        <span className="flex-shrink-0">{resolveIcon(iconName, "w-5 h-5")}</span>
      )}
      <span className="truncate">{children}</span>
    </Link>
  );
}

// ---------- SectionHeader (accordion toggle) ----------
function SectionHeader({ id, title, iconName, open, onToggle, accent = "text-indigo-500" }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      aria-expanded={open}
      aria-controls={`section-${id}`}
    >
      <div className="flex items-center gap-2">
        <span className={accent}>{resolveIcon(iconName, "w-4 h-4")}</span>
        <span>{title}</span>
      </div>
      <svg
        className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M6 6L14 10L6 14V6Z" />
      </svg>
    </button>
  );
}

// ---------- Main Sidebar ----------
export default function Sidebar({ className = "", onClose } = {}) {
  const { user } = useAuth();
  const location = useLocation();

  const role = (user?.role_name || user?.role || "").toLowerCase();
  const canAdmin = () =>
    role.includes("admin") || role.includes("super") || role.includes("manager");

  // Accordion state – allow multiple open at once
  const [open, setOpen] = useState({
    schools: false,
    faculty: false,
    academics: false,
    reports: false,
  });

  // Auto‑open the section that matches the current route
  useEffect(() => {
    const path = location.pathname;
    setOpen(prev => {
      const next = { schools: false, faculty: false, academics: false, reports: false };
      if (path.startsWith("/admin/schools") || path.startsWith("/admin/inquiries") || path.startsWith("/admin/orders") || path.startsWith("/admin/strengths")) {
        next.schools = true;
      } else if (path.startsWith("/admin/faculty")) {
        next.faculty = true;
      } else if (path.startsWith("/admin/academics")) {
        next.academics = true;
      } else if (path.startsWith("/admin/reports")) {
        next.reports = true;
      }
      // Preserve manually opened sections that aren't affected by route
      return { ...prev, ...next };
    });
  }, [location.pathname]);

  const toggle = (section) => {
    setOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const closeIfMobile = () => {
    if (typeof onClose === "function") onClose();
  };

  return (
    <aside
      className={`
        sidebar flex flex-col border-r border-slate-200 bg-white
        text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
        w-64 lg:w-72
        ${className}
      `}
      aria-label="Main navigation"
    >
      {/* Scrollable content – fills available height */}
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {/* User info */}
        <div className="mb-4 border-b border-slate-200 pb-4 dark:border-slate-700" aria-label="User information">
          <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
          <p className="truncate text-base font-semibold">
            {user?.username || user?.employee_name || user?.name || "User"}
          </p>
          <p className="text-xs capitalize text-slate-400 dark:text-slate-500">{role || "—"}</p>
        </div>

        {canAdmin() ? (
          <>
            {/* Dashboard */}
            <div className="mb-2">
              <NavLink to="/dashboard/admin" iconName="dashboard" onClick={closeIfMobile}>
                Dashboard
              </NavLink>
            </div>

            {/* Schools section */}
            <div className="mb-2">
              <SectionHeader
                id="schools"
                title="Schools"
                iconName="schools"
                open={open.schools}
                onToggle={toggle}
                accent="text-rose-500"
              />
              <div
                id="section-schools"
                className={`overflow-hidden transition-all duration-300 ${
                  open.schools ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
                aria-hidden={!open.schools}
              >
                <div className="mt-1 space-y-1 pl-2">
                  <NavLink to="/admin/schools" iconName="schools" onClick={closeIfMobile}>
                    School List
                  </NavLink>
                  <div className="mb-1 ml-2 mt-2 text-[10px] uppercase text-slate-400 dark:text-slate-500">Actions</div>
                  <NavLink to="/admin/inquiries" indent iconName="inquiries" onClick={closeIfMobile}>
                    Inquiry Management
                  </NavLink>
                  <NavLink to="/admin/strengths" indent iconName="strength" onClick={closeIfMobile}>
                    Strength & Requirements
                  </NavLink>
                  <NavLink to="/admin/orders" indent iconName="orders" onClick={closeIfMobile}>
                    Orders Management
                  </NavLink>
                </div>
              </div>
            </div>

            {/* Faculty section */}
            <div className="mb-2">
              <SectionHeader
                id="faculty"
                title="Faculty"
                iconName="faculty"
                open={open.faculty}
                onToggle={toggle}
                accent="text-emerald-500"
              />
              <div
                id="section-faculty"
                className={`overflow-hidden transition-all duration-300 ${
                  open.faculty ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                }`}
                aria-hidden={!open.faculty}
              >
                <div className="mt-1 space-y-1 pl-2">
                  <NavLink to="/admin/faculty" iconName="faculty" onClick={closeIfMobile}>
                    Faculty List
                  </NavLink>
                  <NavLink to="/admin/faculty/assign" indent iconName="faculty" onClick={closeIfMobile}>
                    Faculty Assignment
                  </NavLink>
                </div>
              </div>
            </div>

            {/* Academics section */}
            <div className="mb-2">
              <SectionHeader
                id="academics"
                title="Academics"
                iconName="academics"
                open={open.academics}
                onToggle={toggle}
                accent="text-indigo-500"
              />
              <div
                id="section-academics"
                className={`overflow-hidden transition-all duration-300 ${
                  open.academics ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                }`}
                aria-hidden={!open.academics}
              >
                <div className="mt-1 space-y-1 pl-2">
                  <NavLink to="/admin/academics/timetables" iconName="timetable" onClick={closeIfMobile}>
                    Time-Tables
                  </NavLink>
                  <NavLink to="/admin/academics/class-sessions" iconName="classes" onClick={closeIfMobile}>
                    Class Sessions
                  </NavLink>
                  <NavLink to="/admin/academics/courses" iconName="courses" onClick={closeIfMobile}>
                    Courses
                  </NavLink>
                  <NavLink to="/admin/academics/books" iconName="books" onClick={closeIfMobile}>
                    Books
                  </NavLink>
                  <NavLink to="/admin/academics/videos" iconName="videos" onClick={closeIfMobile}>
                    Videos
                  </NavLink>
                </div>
              </div>
            </div>

            {/* Reports section */}
            <div className="mb-2">
              <SectionHeader
                id="reports"
                title="Reports"
                iconName="reports"
                open={open.reports}
                onToggle={toggle}
                accent="text-amber-500"
              />
              <div
                id="section-reports"
                className={`overflow-hidden transition-all duration-300 ${
                  open.reports ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                }`}
                aria-hidden={!open.reports}
              >
                <div className="mt-1 space-y-1 pl-2">
                  <NavLink to="/admin/reports/faculty-attendance" indent iconName="report-item" onClick={closeIfMobile}>
                    Faculty Attendance
                  </NavLink>
                  <NavLink to="/admin/reports/faculty-progress" indent iconName="report-item" onClick={closeIfMobile}>
                    Faculty Progress
                  </NavLink>
                  <NavLink to="/admin/reports/school-inquiries" indent iconName="report-item" onClick={closeIfMobile}>
                    School Inquiries
                  </NavLink>
                  <NavLink to="/admin/reports/school-orders" indent iconName="report-item" onClick={closeIfMobile}>
                    School Orders
                  </NavLink>
                  <NavLink to="/admin/reports/syllabus-status" indent iconName="report-item" onClick={closeIfMobile}>
                    Syllabus Status
                  </NavLink>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="mb-2 px-2 text-xs uppercase text-slate-400 dark:text-slate-500">Navigation</div>
            <NavLink to="/dashboard" iconName="dashboard" onClick={closeIfMobile}>
              Dashboard
            </NavLink>
            <NavLink to="/profile" iconName="faculty" onClick={closeIfMobile}>
              Profile
            </NavLink>
            {(role.includes("admin") || role.includes("super")) && (
              <NavLink to="/admin" iconName="settings" onClick={closeIfMobile}>
                Administration
              </NavLink>
            )}
          </div>
        )}

        {/* Pushes footer to bottom */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          © AnkVidhya ERP
        </div>
      </div>
    </aside>
  );
}