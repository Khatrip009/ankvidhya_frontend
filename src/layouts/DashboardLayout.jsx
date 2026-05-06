// src/layouts/DashboardLayout.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import InstallBanner from "../components/InstallBanner";


export default function DashboardLayout({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  if (isLogin) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900">{children}</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* install as an application */}
      <InstallBanner />

      {/* Topbar */}
      <Topbar logoClass="h-10 w-10 object-contain" />

      {/* Row: sidebar + main — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar container – hidden on mobile, fixed width on desktop */}
        <aside className="hidden md:block w-64 lg:w-72 flex-shrink-0 h-full">
          <Sidebar />
        </aside>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>

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