// src/App.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  lazy,
  Suspense,
} from "react";

import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Login from "./pages/Login";
import auth from "./lib/auth";

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
import Class_Sessions from "./pages/class_sessions";
import CoursePage from "./pages/courses";
import BooksPage from "./pages/books";
import VideosPage from "./pages/videos";

// Lazy load inquiry
const InquiryLazy = lazy(() => import("./pages/inquiry"));

/* ===================================================
   Auth Context
=================================================== */
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const token = auth.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await auth.loadMe();
        if (mounted) setUser(me);
      } catch (e) {
        auth.logout();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    function onStorage() {
      try {
        setUser(JSON.parse(localStorage.getItem("user") || "null"));
      } catch {
        setUser(null);
      }
    }

    function onAuthChanged(e) {
      const detailUser = e?.detail?.user;
      if (detailUser === undefined) onStorage();
      else setUser(detailUser || null);
    }

    function onAuthExpired() {
      auth.logout();
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

  function logout() {
    auth.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ===================================================
   Protected Route
=================================================== */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

/* ===================================================
   Role-Based Dashboard Redirect
=================================================== */
function decideDashboardByRole(roleRaw = "") {
  const role = (roleRaw || "").toLowerCase();

  if (!role) return "/dashboard";

  if (
    role.includes("admin") ||
    role.includes("super") ||
    role.includes("manager") ||
    role.includes("owner")
  )
    return "/dashboard/admin";

  if (
    role.includes("faculty") ||
    role.includes("teacher") ||
    role.includes("instructor")
  )
    return "/dashboard/faculty";

  if (role.includes("school")) return "/dashboard/school";

  return "/dashboard";
}

function DashboardLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const roleFromUser = user?.role_name || user?.role || "";
    navigate(decideDashboardByRole(roleFromUser), { replace: true });
  }, [user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Redirecting…
    </div>
  );
}

/* ===================================================
   Inquiry Wrapper
=================================================== */
function InquiryRoute() {
  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <nav className="text-sm" aria-label="Breadcrumb">
          <ol className="flex text-slate-500">
            <li>
              <Link
                to="/dashboard/admin"
                className="text-slate-500 hover:text-slate-700"
              >
                Dashboard
              </Link>
            </li>
            <li className="mx-2">/</li>
            <li className="text-slate-700 font-medium">Inquiry Management</li>
          </ol>
        </nav>
      </div>

      <Suspense
        fallback={
          <div className="p-6 bg-white border rounded text-center">
            Loading inquiries…
          </div>
        }
      >
        <InquiryLazy />
      </Suspense>
    </div>
  );
}

/* ===================================================
   Layout Container (Sidebar + Topbar)
=================================================== */
function Layout({ children }) {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith("/login");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {!hideHeader && <Topbar logoClass="h-10 w-10 object-contain" />}

      <div className="w-full flex">
        {!hideHeader && <Sidebar className="hidden md:block w-64" />}

        <main className="flex-1 min-h-screen py-8 px-6">{children}</main>
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

/* ===================================================
   Login Guard
=================================================== */
function LoginGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(
        decideDashboardByRole(user.role_name || user.role || ""),
        { replace: true }
      );
    }
  }, [user, loading]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );

  if (user) return null;

  return <Login />;
}

/* ===================================================
   Main Router
=================================================== */
function AppContainer() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginGuard />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLanding />
            </ProtectedRoute>
          }
        />

        {/* DASHBOARDS */}
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

        {/* ADMIN ROUTES */}
        <Route
          path="/admin/schools"
          element={
            <ProtectedRoute>
              <SchoolsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inquiries"
          element={
            <ProtectedRoute>
              <InquiryRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/orders/:id"
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

        {/* ACADEMICS */}
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

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Layout>
  );
}

/* ===================================================
   APP ROOT
=================================================== */
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContainer />
      </AuthProvider>
    </HashRouter>
  );
}
