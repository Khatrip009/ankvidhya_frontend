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

  const base = `
    flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium
    transition-colors duration-150 group
    ${indent ? "pl-10" : "pl-2"}
    ${active
      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-sm"
      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
    }
  `;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${base} ${className}`}
      aria-current={active ? "page" : undefined}
    >
      {iconName && (
        <span className="flex-shrink-0">{resolveIcon(iconName, "w-5 h-5")}</span>
      )}
      <span className="truncate">{children}</span>
    </Link>
  );
}

// ---------- SectionHeader (accordion button) ----------
function SectionHeader({ id, title, iconName, open, onToggle, accent = "text-indigo-500" }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      aria-expanded={open}
      aria-controls={`section-${id}`}
    >
      <div className="flex items-center gap-2">
        <span className={accent}>{resolveIcon(iconName, "w-4 h-4")}</span>
        <span>{title}</span>
      </div>
      <svg
        className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
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

  // Permissions fallback
  let perms = [];
  try {
    perms = JSON.parse(localStorage.getItem("permissions") || "[]");
  } catch {
    perms = [];
  }
  const role = (user?.role_name || user?.role || "").toLowerCase();
  const canAdmin = () =>
    role.includes("admin") || role.includes("super") || role.includes("manager");

  // Accordion state (only one open at a time)
  const [open, setOpen] = useState({
    schools: false,
    faculty: false,
    academics: false,
    reports: false,
  });

  // Auto-open section based on current path
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith("/admin/schools") || p.startsWith("/admin/inquiries") || p.startsWith("/admin/orders") || p.startsWith("/admin/strengths")) {
      setOpen({ schools: true, faculty: false, academics: false, reports: false });
    } else if (p.startsWith("/admin/faculty")) {
      setOpen({ schools: false, faculty: true, academics: false, reports: false });
    } else if (p.startsWith("/admin/academics")) {
      setOpen({ schools: false, faculty: false, academics: true, reports: false });
    } else if (p.startsWith("/admin/reports")) {
      setOpen({ schools: false, faculty: false, academics: false, reports: true });
    }
  }, [location.pathname]);

  const toggle = (section) => {
    setOpen((prev) => {
      const newState = { schools: false, faculty: false, academics: false, reports: false };
      newState[section] = !prev[section];
      return newState;
    });
  };

  const closeIfMobile = () => {
    if (typeof onClose === "function") onClose();
  };

  return (
    <aside
      className={`sidebar h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 
        flex flex-col p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700
        w-full max-w-xs md:max-w-sm lg:max-w-md
        ${className}`}
      aria-label="Main navigation"
    >
      {/* User info */}
      <div className="pb-4 mb-4 border-b border-slate-200 dark:border-slate-700" aria-label="User information">
        <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
        <p className="text-base font-semibold truncate">
          {user?.username || user?.employee_name || user?.name || "User"}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{role || "—"}</p>
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
              className={`overflow-hidden transition-all duration-300 ${open.schools ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
              aria-hidden={!open.schools}
            >
              <div className="pl-2 space-y-1 mt-1">
                <NavLink to="/admin/schools" iconName="schools" onClick={closeIfMobile}>
                  School List
                </NavLink>
                <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500 ml-2 mt-2 mb-1">Actions</div>
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
              className={`overflow-hidden transition-all duration-300 ${open.faculty ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}
              aria-hidden={!open.faculty}
            >
              <div className="pl-2 space-y-1 mt-1">
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
              className={`overflow-hidden transition-all duration-300 ${open.academics ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}
              aria-hidden={!open.academics}
            >
              <div className="pl-2 space-y-1 mt-1">
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
              className={`overflow-hidden transition-all duration-300 ${open.reports ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}
              aria-hidden={!open.reports}
            >
              <div className="pl-2 space-y-1 mt-1">
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
          <div className="text-xs uppercase text-slate-400 dark:text-slate-500 mb-2 px-2">Navigation</div>
          <NavLink to="/dashboard" iconName="dashboard" onClick={closeIfMobile}>
            Dashboard
          </NavLink>
          <NavLink to="/profile" iconName="faculty" onClick={closeIfMobile}>
            Profile
          </NavLink>
          {role && (role.includes("admin") || role.includes("super")) && (
            <NavLink to="/admin" iconName="settings" onClick={closeIfMobile}>
              Administration
            </NavLink>
          )}
        </div>
      )}

      {/* Optional footer */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500">
        © AnkVidhya ERP
      </div>
    </aside>
  );
}