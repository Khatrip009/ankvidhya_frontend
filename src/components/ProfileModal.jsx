// src/components/ProfileModal.jsx
import React, { useEffect, useRef } from "react";
import Profile from "./profile.jsx";
import { IconBtn } from "./buttons.jsx";
import ERPIcons from "./icons.jsx";

/**
 * ProfileModal – production‑ready, mobile‑first, dark‑mode
 *
 * Props:
 *   open: boolean
 *   onClose: function
 *   initialUser: object passed to Profile
 *   onSaved: function passed to Profile
 */
export default function ProfileModal({ open, onClose, initialUser, onSaved }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";
      // Focus the modal after a tick for accessibility
      setTimeout(() => modalRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = "";
      // Restore focus to previously active element
      previousActiveElement.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && open) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container – full screen on mobile, centered card on sm+ */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        tabIndex={-1}
        className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="profile-modal-title"
            className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100"
          >
            Manage Profile
          </h2>
          <IconBtn
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ERPIcons.Close className="w-5 h-5" />
          </IconBtn>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          <Profile initialUser={initialUser} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}