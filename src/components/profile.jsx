/*
  profile.jsx
  ERP-grade Profile management components for Shreeja ERP

  - Fixed syntax error (stray `try:` -> `try {`)
  - Uses real api.put('/api/users/me', form) in ProfileForm.save()
  - Calls onSaved(updatedUser) after successful save
  - Small improvements to error handling and status messages
*/

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  TextInput,
  TextArea,
  FormField,
  ToggleSwitch,
} from "./input";
import ERPIcons from "./icons";
import { PrimaryBtn, SecondaryBtn, FAB } from "./buttons";
import api from "../lib/api";

const cx = (...c) => c.filter(Boolean).join(" ");

/* -------------------- Helpers / mocks -------------------- */
const mockDelay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

const uploadAvatar = async (file) => {
  // keep mock for avatar upload — replace with real upload endpoint if you have one
  await mockDelay(800);
  return { ok: true, url: URL.createObjectURL(file) };
};

const fetchActivities = async ({ offset = 0, limit = 20 } = {}) => {
  await mockDelay(400);
  const activities = Array.from({ length: limit }).map((_, i) => ({
    id: offset + i + 1,
    type: ["login", "profile_update", "order", "invoice"][
      Math.floor(Math.random() * 4)
    ],
    text: [
      "Logged in",
      "Updated profile",
      "Created order #" + (1000 + Math.floor(Math.random() * 9000)),
      "Paid invoice #" + (2000 + Math.floor(Math.random() * 9000)),
    ][Math.floor(Math.random() * 4)],
    time: new Date(
      Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24)
    ).toISOString(),
  }));
  return { ok: true, data: activities, total: 500 };
};

/* -------------------- AvatarUploader -------------------- */
export const AvatarUploader = ({ value, onChange, size = 96 }) => {
  const [preview, setPreview] = useState(value || null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const onFile = async (files) => {
    const f = files && files[0];
    if (!f) return;
    setUploading(true);
    try {
      const res = await uploadAvatar(f);
      if (res.ok) {
        setPreview(res.url);
        onChange && onChange(res.url);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        style={{ width: size, height: size }}
        className="rounded-full overflow-hidden bg-slate-100 flex items-center justify-center relative"
      >
        {preview ? (
          <img
            src={preview}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-slate-400 text-xl">{("U").toUpperCase()}</div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs">
            Uploading…
          </div>
        )}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files)}
          className="hidden"
        />
        <span className="px-3 py-1 rounded bg-white border">Change avatar</span>
      </label>
    </div>
  );
};

/* -------------------- ProfileForm -------------------- */
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

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setStatus(null);

    // Basic client-side validation
    if (!form.name || !form.name.trim()) {
      setStatus({ ok: false, message: "Name is required" });
      setSaving(false);
      return;
    }
    if (!form.email || !form.email.trim()) {
      setStatus({ ok: false, message: "Email is required" });
      setSaving(false);
      return;
    }

    try {
      // Production: update self profile
      // Backend updateMe accepts username/email/current_password/new_password — adapt if your backend expects different fields.
      const res = await api.put("/api/users/me", form);
      // Support different response shapes
      const updatedUser = res?.data?.data || res?.data || form;

      setStatus({ ok: true, message: "Profile saved" });

      // Bubble to parent
      if (typeof onSaved === "function") {
        try {
          onSaved(updatedUser);
        } catch (err) {
          console.warn("ProfileForm onSaved callback error", err);
        }
      }
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
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Profile</h3>
          <div className="text-sm text-slate-500">Update your account details</div>
        </div>
        {status && (
          <div className={status.ok ? "text-emerald-600 text-sm" : "text-rose-600 text-sm"}>
            {status.message}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Full name" required>
          <TextInput value={form.name} onChange={(v) => update("name", v)} placeholder="Full name" />
        </FormField>

        <FormField label="Email" required>
          <TextInput value={form.email} onChange={(v) => update("email", v)} placeholder="email@company.com" />
        </FormField>

        <FormField label="Phone">
          <TextInput value={form.phone} onChange={(v) => update("phone", v)} placeholder="+91 99999 99999" />
        </FormField>

        <FormField label="Short bio">
          <TextArea value={form.bio} onChange={(v) => update("bio", v)} placeholder="A short bio shown on your profile" />
        </FormField>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <PrimaryBtn onClick={save} loading={saving}>Save profile</PrimaryBtn>
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

/* -------------------- SecuritySettings -------------------- */
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
    try {
      // Hook in real password-change API if available.
      await mockDelay(800);
      setMessage({ ok: true, text: "Password updated" });
      onPasswordChanged && onPasswordChanged();
      setCurrent("");
      setPassword("");
      setConfirm("");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold mb-2">Security</h3>
      <div className="text-sm text-slate-500 mb-4">Change your password and view security settings</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField label="Current password"><TextInput type="password" value={current} onChange={setCurrent} /></FormField>
        <FormField label="New password"><TextInput type="password" value={password} onChange={setPassword} /></FormField>
        <FormField label="Confirm new"><TextInput type="password" value={confirm} onChange={setConfirm} /></FormField>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <PrimaryBtn onClick={change} loading={saving}>Update password</PrimaryBtn>
        {message && <div className={message.ok ? "text-emerald-600 text-sm" : "text-rose-600 text-sm"}>{message.text}</div>}
      </div>
    </div>
  );
};

/* -------------------- PreferencesPanel -------------------- */
export const PreferencesPanel = ({ settings = {}, onChange }) => {
  const [local, setLocal] = useState({ notifications: true, digest: false, ...settings });
  useEffect(() => setLocal({ notifications: true, digest: false, ...settings }), [settings]);

  const toggle = (k) => { const n = { ...local, [k]: !local[k] }; setLocal(n); onChange && onChange(n); };

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold mb-2">Preferences</h3>
      <div className="text-sm text-slate-500 mb-4">Manage notification and display preferences</div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Email notifications</div>
            <div className="text-xs text-slate-500">Receive email updates</div>
          </div>
          <ToggleSwitch checked={local.notifications} onChange={() => toggle("notifications")} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Daily digest</div>
            <div className="text-xs text-slate-500">One email summary per day</div>
          </div>
          <ToggleSwitch checked={local.digest} onChange={() => toggle("digest")} />
        </div>
      </div>
    </div>
  );
};

/* -------------------- ActivityList -------------------- */
export const ActivityList = ({ initial = [], pageSize = 20 }) => {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { loadMore(); }, []); // initial load

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetchActivities({ offset: page * pageSize, limit: pageSize });
      if (res.ok) {
        setItems(it => [...it, ...res.data]);
        setPage(p => p + 1);
        if (res.data.length < pageSize) setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h4 className="font-semibold mb-3">Recent activity</h4>
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <ERPIcons.Notification className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{a.text}</div>
              <div className="text-xs text-slate-500">{new Date(a.time).toLocaleString()}</div>
            </div>
          </div>
        ))}

        {loading && <div className="text-sm text-slate-500">Loading…</div>}

        {hasMore && !loading && <div className="text-center mt-2"><button className="px-3 py-1 rounded border text-sm" onClick={loadMore}>Load more</button></div>}

        {!hasMore && items.length === 0 && <div className="text-sm text-slate-500">No recent activity yet</div>}
      </div>
    </div>
  );
};

/* -------------------- ProfileSkeleton -------------------- */
export const ProfileSkeleton = () => (
  <div className="p-6 space-y-4">
    <div className="animate-pulse flex items-center gap-4">
      <div className="w-24 h-24 bg-slate-200 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-40 bg-slate-200 rounded" />
      <div className="h-40 bg-slate-200 rounded" />
    </div>
  </div>
);

/* -------------------- ProfilePage (default export) -------------------- */
export default function ProfilePage({ initialUser = null, onSaved = null }) {
  const [user, setUser] = useState(initialUser ?? { name: "User Name", email: "user@example.com", phone: "", bio: "" });
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (initialUser) setUser(prev => ({ ...prev, ...initialUser }));
  }, [initialUser]);

  const handleProfileSaved = (updated) => {
    setUser(prev => ({ ...prev, ...updated }));
    if (typeof onSaved === "function") {
      try { onSaved(updated); } catch (e) { console.warn("ProfilePage onSaved error", e); }
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4">
            <AvatarUploader value={avatar} onChange={setAvatar} />
            <div className="text-center">
              <div className="font-semibold text-lg">{user.name || user.username || "User"}</div>
              <div className="text-sm text-slate-500">{user.email || "user@example.com"}</div>
            </div>
            <div className="w-full">
              <PrimaryBtn onClick={() => alert("Go to public profile")}>View public profile</PrimaryBtn>
            </div>
          </div>

          <PreferencesPanel settings={{ notifications: true }} onChange={(s) => console.log("prefs", s)} />

          <SecuritySettings onPasswordChanged={() => alert("Password changed")} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ProfileForm user={user} onSaved={handleProfileSaved} />

          <ActivityList />

          <div className="flex items-center justify-end">
            <FAB icon={() => (<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>)} onClick={() => alert("Start new action")} label="New" />
          </div>
        </div>
      </div>
    </div>
  );
}
