// src/components/ProfileModal.jsx
import React from "react";
import Profile from "./profile.jsx";
import { SecondaryBtn } from "./buttons.jsx";

/**
 * ProfileModal
 * - `initialUser` is passed to Profile so it can prepopulate from useAuth().
 * - `onSaved` is called when ProfileForm successfully saves (bubbles up from Profile).
 */
export default function ProfileModal({ open, onClose, initialUser, onSaved }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Manage Profile
          </h2>
          <SecondaryBtn onClick={onClose}>Close</SecondaryBtn>
        </div>

        {/* Body (Profile component inside modal) */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          <Profile initialUser={initialUser} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}
