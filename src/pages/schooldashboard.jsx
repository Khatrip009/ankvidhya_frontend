// src/pages/schooldashboard.jsx
import React from "react";

export default function SchoolDashboard() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">School Dashboard</h1>
      <p className="text-sm text-slate-600 mb-6">Placeholder school dashboard. Replace with school-specific metrics.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded shadow">Students: —</div>
        <div className="p-4 bg-white rounded shadow">Teachers: —</div>
      </div>
    </main>
  );
}
