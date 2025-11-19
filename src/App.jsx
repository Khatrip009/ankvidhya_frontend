// src/App.jsx
import React, { createContext, useContext, useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Login from "./pages/Login";
import auth from "./lib/auth";
import api from "./lib/api";

import AdminDashboard from "./pages/admindashboard";
import FacultyDashboard from "./pages/facultydashboard";
import SchoolDashboard from "./pages/schooldashboard";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import OrdersPage from "./pages/orders";
import StrengthsPage from "./pages/strengths";
import SchoolsPage from "./pages/schools";
import FacultyPage from "./pages/faculty";
import FacultyAssignments from "./pages/faculty_assignments";
import TimetablesPage from "./pages/timetable"; 
import Class_Sessions from "./pages/class_sessions"
import CoursePage from "./pages/courses";
import BooksPage from "./pages/books";
import VideosPage from "./pages/videos";
/* =========================
   Lazy-load Inquiry page
   ========================= */
const InquiryLazy = lazy(() => import("./pages/inquiry"));

/* =========================
   AuthProvider + useAuth
   ========================= */
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const token = auth.getToken();
      if (!token) return;
      setLoading(true);
      try {
        const me = await auth.loadMe();
        if (!mounted) return;
        setUser(me);
      } catch (e) {
        auth.setToken("");
        try { localStorage.removeItem("user"); } catch {}
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();

    // storage changes from other tabs (still useful)
    function onStorage() {
      try {
        setUser(JSON.parse(localStorage.getItem("user") || "null"));
      } catch {
        setUser(null);
      }
    }

    // same-tab custom event when auth changes (login/logout)
    function onAuthChanged(e) {
      try {
        const detailUser = e?.detail?.user;
        if (detailUser === undefined) {
          // fallback to reading localStorage
          onStorage();
        } else {
          setUser(detailUser || null);
        }
      } catch {
        onStorage();
      }
    }

    // react to central "auth:expired" if api says token no longer valid
    function onAuthExpired() {
      auth.setToken('');
      try { localStorage.removeItem('user'); } catch {}
      setUser(null);
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);
    window.addEventListener("auth:expired", onAuthExpired);

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
      window.removeEventListener("auth:expired", onAuthExpired);
    };
  }, []);

  async function loginWithToken(token) {
    auth.setToken(token);
    try {
      const me = await auth.loadMe();
      setUser(me);
      return me;
    } catch (e) {
      auth.setToken("");
      throw e;
    }
  }

  function logout() {
    // auth.logout clears token & local storage and emits auth:changed
    auth.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/* =========================
   ProtectedRoute
   ========================= */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/* =========================
   Helper: decide dashboard by role
   ========================= */
function decideDashboardByRole(roleRaw = "") {
  const role = (roleRaw || "").toString().toLowerCase();
  if (!role) return "/dashboard";
  if (role.includes("admin") || role.includes("super") || role.includes("manager") || role.includes("owner")) return "/dashboard/admin";
  if (role.includes("faculty") || role.includes("teacher") || role.includes("instructor")) return "/dashboard/faculty";
  if (role.includes("school") || role.includes("school_admin") || role.includes("schooladmin")) return "/dashboard/school";
  return "/dashboard";
}

/* =========================
   Dashboard landing: redirect to role-specific dashboard
   ========================= */
function DashboardLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const roleFromUser = user ? (user.role_name || user.role || "") : (localStorage.getItem("role") || "");
    const target = decideDashboardByRole(roleFromUser);
    navigate(target, { replace: true });
  }, [user, navigate]);

  return <div className="min-h-screen flex items-center justify-center">Redirecting…</div>;
}

/* =========================
   Inquiry route wrapper (breadcrumb + lazy-loaded page)
   ========================= */
function InquiryRoute() {
  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <nav className="text-sm" aria-label="Breadcrumb">
          <ol className="list-reset flex text-slate-500">
            <li>
              <Link to="/dashboard/admin" className="text-slate-500 hover:text-slate-700">Dashboard</Link>
            </li>
            <li><span className="mx-2">/</span></li>
            <li className="text-slate-700 font-medium">Inquiry Management</li>
          </ol>
        </nav>
      </div>

      <Suspense fallback={<div className="p-6 bg-white border rounded text-center">Loading inquiries…</div>}>
        <InquiryLazy />
      </Suspense>
    </div>
  );
}

/* =========================
   App container & route boot
   ========================= */
function AppContainer() {
  const location = useLocation();
  // hide header/sidebar for any login-like path
  const hideHeader = location.pathname.startsWith("/login");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {!hideHeader && <Topbar logoClass="h-10 w-10 object-contain" />}

      {/* Full width layout so sidebar is flush left */}
      <div className="w-full">
        <div className="flex gap-6">
          {/* Sidebar visible on md+ via class; Topbar handles mobile drawer */}
          {!hideHeader && <Sidebar className="hidden md:block w-64" />}

          <main className="flex-1 min-h-screen py-8 px-6">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginGuard />} />

              {/* Main dashboard routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLanding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/faculty"
                element={
                  <ProtectedRoute>
                    <FacultyDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/school"
                element={
                  <ProtectedRoute>
                    <SchoolDashboard />
                  </ProtectedRoute>
                }
              />
              {/* Schools routes */}
              <Route
                path="/admin/schools"
                element={
                  <ProtectedRoute>
                    <SchoolsPage />
                  </ProtectedRoute>
                }
              />

              {/* Lazy-loaded Inquiry Management route */}
              <Route
                path="/admin/inquiries"
                element={
                  <ProtectedRoute>
                    <InquiryRoute />
                  </ProtectedRoute>
                }
              />

              {/* Orders routes */}
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />

               <Route
                path="/admin/strengths"
                element={
                  <ProtectedRoute>
                    <StrengthsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/faculty"
                element={
                  <ProtectedRoute>
                    <FacultyPage />
                  </ProtectedRoute>
                }
                
              />
              <Route
                path="/admin/faculty/assign"
                element={
                  <ProtectedRoute>
                    <FacultyAssignments />
                  </ProtectedRoute>
                }
                
              />

              <Route
                path="/admin/academics/timetables"
                element={
                  <ProtectedRoute>
                    <TimetablesPage />
                  </ProtectedRoute>
                }
                
              />

              <Route
                path="/admin/academics/class-sessions"
                element={
                  <ProtectedRoute>
                    <Class_Sessions />
                  </ProtectedRoute>
                }
                
              />

               <Route
                path="/admin/academics/courses"
                element={
                  <ProtectedRoute>
                    <CoursePage />
                  </ProtectedRoute>
                }
                
              />
                <Route
                path="/admin/academics/books"
                element={
                  <ProtectedRoute>
                    <BooksPage />
                  </ProtectedRoute>
                }
                
              />
              
              <Route
                path="/admin/academics/videos"
                element={
                  <ProtectedRoute>
                    <VideosPage />
                  </ProtectedRoute>
                }
                
              />

              {/* Optional deep-link route — reuse same component (component can be enhanced to auto-open modal when :id present) */}
              <Route
                path="/admin/orders/:id"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback: send to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      {!hideHeader && (
        <footer className="border-t mt-12 bg-white">
          <div className="w-full py-6 text-sm text-slate-500 px-6">
            © {new Date().getFullYear()} AnkVidhya. Built with ❤️.
          </div>
        </footer>
      )}
    </div>
  );
}

/* If user is authed, redirect /login -> /dashboard. Otherwise render Login page */
function LoginGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      const roleFromUser = user ? (user.role_name || user.role || "") : (localStorage.getItem("role") || "");
      const target = decideDashboardByRole(roleFromUser);
      navigate(target, { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (user) return null;
  return <Login />;
}

/* =========================
   App root export
   ========================= */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}
