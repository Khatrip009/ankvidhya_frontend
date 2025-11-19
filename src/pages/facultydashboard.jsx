// src/pages/facultydashboard.jsx
import React from "react";

export default function FacultyDashboard() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Faculty Dashboard</h1>
      <p className="text-sm text-slate-600 mb-6">Placeholder faculty dashboard. Add attendance, lesson plans, tasks here.</p>

      <div className="space-y-4">
        <div className="p-4 bg-white rounded shadow">Today's classes: —</div>
        <div className="p-4 bg-white rounded shadow">Pending assignments: —</div>
      </div>
    </main>
  );
}
