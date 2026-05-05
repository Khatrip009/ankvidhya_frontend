// src/pages/Profile.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TextInput,
  TextArea,
  FormField,
  ToggleSwitch,
} from "../components/input";
import ERPIcons from "../components/icons";
import { PrimaryBtn, SecondaryBtn, FAB } from "../components/buttons";
import api from "../lib/api";

const cx = (...c) => c.filter(Boolean).join(" ");

/* ---------- AvatarUploader ---------- */
export const AvatarUploader = ({ value, onChange, size = 96 }) => {
  const [preview, setPreview] = useState(value || null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const onFile = async (files) => {
    const file = files?.[0];
    if (!file) return;

    // Real upload – replace with your actual endpoint and form data
    const formData = new FormData();
    formData.append("avatar", file);

    setUploading(true);
    try {
      const res = await api.post("/api/users/me/avatar", formData);
      const url = res?.data?.url || res?.data?.data?.url;
      if (url) {
        setPreview(url);
        onChange?.(url);
      }
    } catch (err) {
      console.error("Avatar upload failed", err);
      // Fallback: show local preview if server fails
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      onChange?.(localUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        style={{ width: size, height: size }}
        className="rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center relative"
      >
        {preview ? (
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-xl">
            {(value || "U").charAt(0).toUpperCase()}
          </span>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs rounded-full">
            Uploading…
          </div>
        )}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files)}
          className="hidden"
        />
        <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600">
          Change avatar
        </span>
      </label>
    </div>
  );
};

/* ---------- ProfileForm ---------- */
export const ProfileForm = ({ user = {}, onSaved }) => {
  const [form, setForm] = useState({
    name: user.name || user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    bio: user.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setForm({
      name: user.name || user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      bio: user.bio || "",
    });
  }, [user]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name?.trim()) {
      setStatus({ ok: false, message: "Name is required" });
      return;
    }
    if (!form.email?.trim()) {
      setStatus({ ok: false, message: "Email is required" });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const res = await api.put("/api/users/me", form);
      const updatedUser = res?.data?.data || res?.data || form;
      setStatus({ ok: true, message: "Profile saved" });
      onSaved?.(updatedUser);
    } catch (err) {
      console.error("Profile save error", err);
      const msg =
        err?.response?.data?.message || err?.message || "Failed to save profile";
      setStatus({ ok: false, message: msg });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Profile
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Update your account details
          </p>
        </div>
        {status && (
          <div
            className={`text-sm font-medium ${
              status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full name" required>
          <TextInput
            value={form.name}
            onChange={(v) => update("name", v)}
            placeholder="Full name"
          />
        </FormField>
        <FormField label="Email" required>
          <TextInput
            value={form.email}
            onChange={(v) => update("email", v)}
            placeholder="email@company.com"
          />
        </FormField>
        <FormField label="Phone">
          <TextInput
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="+91 99999 99999"
          />
        </FormField>
        <FormField label="Short bio">
          <TextArea
            value={form.bio}
            onChange={(v) => update("bio", v)}
            placeholder="A short bio shown on your profile"
          />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={save} loading={saving}>
          Save profile
        </PrimaryBtn>
        <SecondaryBtn
          onClick={() =>
            setForm({
              name: user.name || user.username || "",
              email: user.email || "",
              phone: user.phone || "",
              bio: user.bio || "",
            })
          }
        >
          Reset
        </SecondaryBtn>
      </div>
    </div>
  );
};

/* ---------- SecuritySettings ---------- */
export const SecuritySettings = ({ onPasswordChanged }) => {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const change = async () => {
    if (!current || !password) {
      setMessage({ ok: false, text: "Current and new password required" });
      return;
    }
    if (password !== confirm) {
      setMessage({ ok: false, text: "Passwords do not match" });
      return;
    }
    if (password.length < 8) {
      setMessage({ ok: false, text: "Password must be at least 8 characters" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.put("/api/users/me/password", {
        current_password: current,
        new_password: password,
      });
      setMessage({ ok: true, text: "Password updated" });
      onPasswordChanged?.();
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      console.error("Password change error", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to update password";
      setMessage({ ok: false, text: msg });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Security
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Change your password and view security settings
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Current password">
          <TextInput
            type="password"
            value={current}
            onChange={setCurrent}
            placeholder="Current password"
          />
        </FormField>
        <FormField label="New password">
          <TextInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="New password"
          />
        </FormField>
        <FormField label="Confirm new">
          <TextInput
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm new password"
          />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={change} loading={saving}>
          Update password
        </PrimaryBtn>
        {message && (
          <div
            className={`text-sm font-medium ${
              message.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- PreferencesPanel ---------- */
export const PreferencesPanel = ({ settings = {}, onChange }) => {
  const [local, setLocal] = useState({
    notifications: true,
    digest: false,
    ...settings,
  });

  useEffect(
    () => setLocal({ notifications: true, digest: false, ...settings }),
    [settings]
  );

  const toggle = (key) => {
    const next = { ...local, [key]: !local[key] };
    setLocal(next);
    onChange?.(next);

    // Persist to server in background (optional)
    api.put("/api/users/me/preferences", next).catch((err) =>
      console.warn("Failed to save preferences", err)
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Preferences
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Manage notification and display preferences
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-700 dark:text-slate-200">
              Email notifications
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Receive email updates
            </div>
          </div>
          <ToggleSwitch
            checked={local.notifications}
            onChange={() => toggle("notifications")}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-700 dark:text-slate-200">
              Daily digest
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              One email summary per day
            </div>
          </div>
          <ToggleSwitch
            checked={local.digest}
            onChange={() => toggle("digest")}
          />
        </div>
      </div>
    </div>
  );
};

/* ---------- ActivityList (real API) ---------- */
export const ActivityList = ({ initial = [], pageSize = 20 }) => {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/activities", {
        params: { offset: page * pageSize, limit: pageSize },
      });
      const data = res?.data?.data || res?.data || [];
      setItems((prev) => [...prev, ...data]);
      setPage((p) => p + 1);
      if (data.length < pageSize) setHasMore(false);
    } catch (err) {
      console.error("Activity fetch error", err);
      setError("Failed to load activities");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, pageSize]);

  useEffect(() => {
    loadMore();
  }, []); // initial load

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-4 sm:p-6">
      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Recent activity
      </h4>

      {/* Mobile: compact list, Desktop: cards */}
      <div className="space-y-3">
        {items.length === 0 && !loading && !error && (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            No recent activity yet.
          </div>
        )}
        {items.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <ERPIcons.Notification className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {a.text || a.action || "Activity"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(a.time || a.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
            Loading…
          </div>
        )}
        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400 text-center py-2">
            {error}
          </div>
        )}
      </div>

      {hasMore && !loading && !error && (
        <button
          className="mt-4 w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
          onClick={loadMore}
        >
          Load more
        </button>
      )}
    </div>
  );
};

/* ---------- ProfileSkeleton ---------- */
export const ProfileSkeleton = () => (
  <div className="p-4 sm:p-6 space-y-4">
    <div className="flex flex-col sm:flex-row items-center gap-4 animate-pulse">
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
      <div className="flex-1 space-y-2 w-full">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
    </div>
  </div>
);

/* ---------- ProfilePage (default export) ---------- */
export default function ProfilePage({ initialUser = null, onSaved = null }) {
  const [user, setUser] = useState(
    initialUser ?? {
      name: "",
      email: "",
      phone: "",
      bio: "",
    }
  );
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (initialUser) setUser((prev) => ({ ...prev, ...initialUser }));
  }, [initialUser]);

  const handleProfileSaved = (updated) => {
    setUser((prev) => ({ ...prev, ...updated }));
    onSaved?.(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4 lg:space-y-6">
          {/* Avatar card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-6 flex flex-col items-center gap-4">
            <AvatarUploader
              value={avatar || user.avatar_url}
              onChange={(url) => setAvatar(url)}
            />
            <div className="text-center">
              <div className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                {user.name || user.username || "User"}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {user.email}
              </div>
            </div>
          </div>

          <PreferencesPanel
            settings={{ notifications: true }}
            onChange={(prefs) => console.log("prefs updated", prefs)}
          />

          <SecuritySettings
            onPasswordChanged={() =>
              alert("Password changed – you may need to log in again.")
            }
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <ProfileForm user={user} onSaved={handleProfileSaved} />

          <ActivityList />
        </div>
      </div>
    </div>
  );
}