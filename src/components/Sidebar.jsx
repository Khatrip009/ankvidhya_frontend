// src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import ERPIcons from "./icons.jsx";

/**
 * Sidebar - production-ready, corporate style (NO background doodles)
 *
 * Notes:
 * - All decorative doodles removed per request.
 * - Sidebar forced above other app layers with a high z-index.
 * - Interactive content explicitly placed above and pointer-events ensured.
 * - Accordion buttons use type="button" to avoid accidental form submission.
 *
 * Drop-in: replace your existing Sidebar.jsx with this file.
 */

/* Small helper to render an icon from ERPIcons safely */
function IconComp({ name, color = "currentColor", size = 18, className = "" }) {
  const map = {
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
  };

  const Comp = map[name] || ERPIcons.Dashboard;
  return <Comp width={size} height={size} style={{ color }} className={className} aria-hidden="true" />;
}

export default function Sidebar({ className = "", onClose } = {}) {
  const { user } = useAuth();
  const location = useLocation();

  // permissions fallback
  let perms = [];
  try {
    perms = JSON.parse(localStorage.getItem("permissions") || "[]");
  } catch {
    perms = [];
  }

  const role = (user?.role_name || user?.role || "").toString().toLowerCase();

  function canAdmin() {
    return role.includes("admin") || role.includes("super") || role.includes("manager");
  }

  // Accordion state - only one open at a time
  const [open, setOpen] = useState({
    schools: true,
    academics: false,
    reports: false,
    faculty: false,
    strength: false,
  });

  useEffect(() => {
    // open section based on current path
    const p = location.pathname;
    if (p.startsWith("/admin/schools") || p.startsWith("/admin/inquiries") || p.startsWith("/admin/orders")) {
      setOpen({ schools: true, academics: false, reports: false, faculty: false, strength: false });
    } else if (p.startsWith("/admin/academics")) {
      setOpen({ schools: false, academics: true, reports: false, faculty: false, strength: false });
    } else if (p.startsWith("/admin/reports")) {
      setOpen({ schools: false, academics: false, reports: true, faculty: false, strength: false });
    } else if (p.startsWith("/admin/faculty")) {
      setOpen({ schools: false, academics: false, reports: false, faculty: true, strength: false });
    } else if (p.startsWith("/admin/strength")) {
      setOpen({ schools: false, academics: false, reports: false, faculty: false, strength: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function toggle(section) {
    setOpen((prev) => {
      const isOpen = !!prev[section];
      if (isOpen) return { schools: false, academics: false, reports: false, faculty: false, strength: false };
      const next = { schools: false, academics: false, reports: false, faculty: false, strength: false };
      next[section] = true;
      return next;
    });
  }

  function handleLinkClick() {
    if (typeof onClose === "function") onClose();
  }

  function NavLink({ to, children, indent = false, iconName, iconColor = "#64748b" }) {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={handleLinkClick}
        className={`navlink ${indent ? "navlink-indent" : ""} ${active ? "navlink-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {iconName && (
          <span className="navlink-icon" aria-hidden>
            <span className="navlink-icon-inner">
              <IconComp name={iconName} color={iconColor} size={18} />
            </span>
          </span>
        )}
        <span className="navlink-label">{children}</span>
      </Link>
    );
  }

  function SectionHeader({ id, title, iconName, accent = "#0ea5a3" }) {
    return (
      <button
        onClick={() => toggle(id)}
        className="section-header"
        aria-expanded={!!open[id]}
        aria-controls={`section-${id}`}
        type="button"
      >
        <div className="section-left">
          <IconComp name={iconName} color={accent} size={18} className="section-icon" />
          <span className="section-title">{title}</span>
        </div>
        <svg
          className={`chev ${open[id] ? "chev-open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path d="M6 6L14 10L6 14V6Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  const accentFor = {
    schools: "#ef4444",
    faculty: "#10b981",
    academics: "#6366f1",
    reports: "#f59e0b",
    strength: "#a78bfa",
    dashboard: "#0ea5a3",
    inquiries: "#06b6d4",
    orders: "#fb923c",
  };

  return (
    <aside className={`sidebar ${className}`} aria-label="Main navigation">
      <style>{`
        /* Sidebar surface */
        .sidebar {
          position: relative;
          width: 280px;
          min-width: 240px;
          max-width: 340px;
          background: linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%);
          border-right: 1px solid rgba(15,23,42,0.04);
          padding: 18px;
          box-sizing: border-box;
          color: #0f172a;
          font-size: 15px;
          line-height: 1.35;
          box-shadow: 0 6px 18px rgba(11,34,80,0.03);
          overflow: auto;
          z-index: 1200;           /* keep it above typical app layers */
          pointer-events: auto;    /* ensure it accepts clicks */
        }

        /* ensure interactive content is above any decorative or accidental overlays */
        .sidebar .content {
          position: relative;
          z-index: 1201;
          pointer-events: auto;
        }

        .user-meta { padding-bottom: 12px; border-bottom: 1px solid rgba(15,23,42,0.03); margin-bottom: 14px; }
        .user-meta .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .user-meta .name { font-weight: 600; font-size: 16px; color: #071233; margin-bottom: 2px; }
        .user-meta .role { font-size: 12px; color: #94a3b8; }

        .section-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          margin-bottom: 6px;
        }
        .section-left { display:flex; align-items:center; gap:10px; }
        .section-title { font-size: 11px; letter-spacing: 0.08em; color: #475569; text-transform: uppercase; font-weight: 600; }
        .section-icon { border-radius: 6px; padding: 4px; }

        .chev { color: #94a3b8; transition: transform .18s ease; }
        .chev-open { transform: rotate(90deg); }

        .section-panel { overflow: hidden; transition: max-height .26s cubic-bezier(.2,.9,.2,1), opacity .26s ease; }
        .section-panel.max { max-height: 640px; opacity: 1; }
        .section-panel.min { max-height: 0; opacity: 0; }

        .navlink {
          display:flex;
          align-items:center;
          gap:10px;
          padding: 9px 8px;
          border-radius: 8px;
          color: #0f172a;
          text-decoration: none;
          margin: 6px 2px;
          transition: background .14s ease, transform .12s ease;
          cursor: pointer;
        }
        .navlink:hover { background: rgba(11,110,255,0.03); transform: translateX(4px); }
        .navlink-indent { padding-left: 40px; font-size: 14px; }
        .navlink-icon { width: 28px; min-width: 28px; display:flex; align-items:center; justify-content:center; }
        .navlink-icon-inner { display:inline-flex; transition: transform .16s ease; }
        .navlink:hover .navlink-icon-inner { transform: translateX(3px) scale(1.02); }
        .navlink-label { font-size: 15px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .navlink-active {
          background: linear-gradient(90deg, rgba(11,110,255,0.06), rgba(14,165,163,0.035));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
          font-weight: 700;
          color: #03263f;
        }

        @media (max-width: 920px) {
          .sidebar { width: 100%; position: relative; max-width: none; padding: 14px; z-index: 1200; }
        }
      `}</style>

      <div className="content">
        <div className="user-meta" role="region" aria-label="User information">
          <div className="label">Signed in as</div>
          <div className="name">{user?.username || user?.employee_name || user?.name || "User"}</div>
          <div className="role">{role || "—"}</div>
        </div>

        {canAdmin() ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <NavLink to="/dashboard/admin" iconName="dashboard" iconColor={accentFor.dashboard}>
                Dashboard
              </NavLink>
            </div>

            {/* Schools */}
            <div>
              <SectionHeader id="schools" title="Schools" iconName="schools" accent={accentFor.schools} />
              <div id="section-schools" className={`section-panel ${open.schools ? "max" : "min"}`} aria-hidden={!open.schools}>
                <NavLink to="/admin/schools" iconName="schools" iconColor={accentFor.schools}>School List</NavLink>
                <div style={{ marginTop: 8, marginLeft: 6, marginBottom: 6, fontSize: 11, color: "#9aa4b2", textTransform: "uppercase" }}>School actions</div>
                <NavLink to="/admin/inquiries" indent iconName="inquiries" iconColor={accentFor.inquiries}>Inquiry Management</NavLink>
                <NavLink to="/admin/strengths" indent iconName="strength" iconColor={accentFor.strength}>Strength & Requirements</NavLink>
                <NavLink to="/admin/orders" indent iconName="orders" iconColor={accentFor.orders}>Orders Management</NavLink>
              </div>
            </div>

            {/* Faculty */}
            <div style={{ marginTop: 10 }}>
              <SectionHeader id="faculty" title="Faculty" iconName="faculty" accent={accentFor.faculty} />
              <div id="section-faculty" className={`section-panel ${open.faculty ? "max" : "min"}`} aria-hidden={!open.faculty}>
                <NavLink to="/admin/faculty" iconName="faculty" iconColor={accentFor.faculty}>Faculty List</NavLink>
                <NavLink to="/admin/faculty/assign" indent iconName="faculty" iconColor={accentFor.faculty}>Faculty Assignment</NavLink>
              </div>
            </div>

            {/* Academics */}
            <div style={{ marginTop: 10 }}>
              <SectionHeader id="academics" title="Academics" iconName="academics" accent={accentFor.academics} />
              <div id="section-academics" className={`section-panel ${open.academics ? "max" : "min"}`} aria-hidden={!open.academics}>
                <NavLink to="/admin/academics/timetables" iconName="timetable" iconColor={accentFor.academics}>Time-Tables</NavLink>
                <NavLink to="/admin/academics/class-sessions" iconName="classes" iconColor={accentFor.academics}>Class Sessions</NavLink>
                <NavLink to="/admin/academics/courses" iconName="courses" iconColor={accentFor.academics}>Courses</NavLink>
                <NavLink to="/admin/academics/books" iconName="books" iconColor={accentFor.academics}>Books</NavLink>
                <NavLink to="/admin/academics/videos" iconName="videos" iconColor={accentFor.academics}>Videos</NavLink>
              </div>
            </div>

            {/* Reports */}
            <div style={{ marginTop: 10 }}>
              <SectionHeader id="reports" title="Reports" iconName="reports" accent={accentFor.reports} />
              <div id="section-reports" className={`section-panel ${open.reports ? "max" : "min"}`} aria-hidden={!open.reports}>
                <NavLink to="/admin/reports/faculty-attendance" iconName="report-item" iconColor={accentFor.reports}>Faculty Attendance</NavLink>
                <NavLink to="/admin/reports/faculty-progress" iconName="report-item" iconColor={accentFor.reports}>Faculty Progress</NavLink>
                <NavLink to="/admin/reports/school-inquiries" iconName="report-item" iconColor={accentFor.reports}>School Inquiries</NavLink>
                <NavLink to="/admin/reports/school-orders" iconName="report-item" iconColor={accentFor.reports}>School Orders</NavLink>
                <NavLink to="/admin/reports/syllabus-status" iconName="report-item" iconColor={accentFor.reports}>Syllabus Status</NavLink>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#9aa4b2", marginBottom: 8 }}>Navigation</div>
            <NavLink to="/dashboard" iconName="dashboard" iconColor={accentFor.dashboard}>Dashboard</NavLink>
            <NavLink to="/profile" iconName="faculty" iconColor={accentFor.faculty}>Profile</NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
