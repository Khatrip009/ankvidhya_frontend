// src/layouts/DashboardLayout.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  // Login page – no shell
  if (isLogin) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900">{children}</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Topbar – fixed height (4rem = h-16) */}
      <Topbar logoClass="h-10 w-10 object-contain" />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Sidebar – hidden on mobile, visible on md+ */}
        <div className="hidden md:flex md:flex-col md:flex-shrink-0 w-64 lg:w-72">
          <Sidebar />
        </div>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>

          {/* Footer inside main so it scrolls naturally */}
          <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800">
            <div className="py-4 px-4 md:px-6 lg:px-8 text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} AnkVidhya. Built with ❤️.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}