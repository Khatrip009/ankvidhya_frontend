// src/pages/courses.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import ERPIcons from "../components/icons.jsx";
import { FormField, TextInput, Select, FileInput } from "../components/input.jsx";
import { SimpleTable, ExportCSV, Pagination } from "../components/table.jsx";
import { PrimaryBtn, SecondaryBtn, OutlineBtn, DangerBtn } from "../components/buttons.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { LoadingCard } from "../components/cards.jsx";

// ---------- Constants ----------
const DEFAULT_IMAGE = "/images/ANK.png";
const MODAL_HEADER_LOGO = "/images/Ank_Logo.png";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const imgOrDefault = (url) => (url && String(url).trim()) ? url : DEFAULT_IMAGE;

export default function CoursesPage() {
  const toast = useToast();

  // Lookup data
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [books, setBooks] = useState([]);

  // Data state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [fMedium, setFMedium] = useState("");
  const [fStd, setFStd] = useState("");
  const [fBook, setFBook] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    course_id: null,
    course_name: "",
    description: "",
    price: "",
    medium_id: "",
    std_id: "",
    book_id: "",
    image: ""
  });
  const [formErrors, setFormErrors] = useState({});

  // File upload state
  const [filePreview, setFilePreview] = useState(DEFAULT_IMAGE);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  // ---------- Load lookups ----------
  useEffect(() => {
    (async () => {
      try {
        const [mRes, sRes, bRes] = await Promise.all([
          api.get("/api/master", { query: { table: "media", pageSize: 1000 } }),
          api.get("/api/master", { query: { table: "standards", pageSize: 1000 } }),
          api.get("/api/books", { query: { pageSize: 1000 } }),
        ]);
        setMediums(mRes?.data || []);
        setStandards(sRes?.data || []);
        setBooks(bRes?.data || []);
      } catch (err) {
        console.error("Lookup load failed", err);
        toast.error("Failed to load dropdown data");
      }
    })();

    const onFocus = () => setIsSelectingFile(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ---------- Fetch courses ----------
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const query = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (searchQuery) query.search = searchQuery;
      if (fMedium) query.medium_id = fMedium;
      if (fStd) query.std_id = fStd;
      if (fBook) query.book_id = fBook;

      const res = await api.get("/api/courses", { query });
      const data = res?.data || [];
      const pg = res?.pagination || { page: pagination.page, pageSize: pagination.pageSize, total: data.length };
      setRows(data);
      setPagination(prev => ({ ...prev, page: pg.page, pageSize: pg.pageSize, total: pg.total }));
    } catch (err) {
      console.error("Fetch courses error", err);
      toast.error("Failed to load courses");
      setRows([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, searchQuery, fMedium, fStd, fBook, toast]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // ---------- Handlers ----------
  const handleCreate = () => {
    setEditing(null);
    setForm({
      course_id: null,
      course_name: "",
      description: "",
      price: "",
      medium_id: "",
      std_id: "",
      book_id: "",
      image: "",
    });
    setFormErrors({});
    setFilePreview(DEFAULT_IMAGE);
    fileRef.current = null;
    setModalOpen(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setForm({
      course_id: row.course_id,
      course_name: row.course_name || "",
      description: row.description || "",
      price: row.price ?? "",
      medium_id: row.medium_id ?? "",
      std_id: row.std_id ?? "",
      book_id: row.book_id ?? "",
      image: row.image || "",
    });
    setFormErrors({});
    setFilePreview(imgOrDefault(row.image));
    fileRef.current = null;
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.course_name}"?`)) return;
    try {
      await api.delete(`/api/courses/${row.course_id}`);
      toast.success("Course deleted");
      fetchCourses();
    } catch (err) {
      console.error("Delete error", err);
      toast.error("Failed to delete course");
    }
  };

  const handleCloseModal = () => {
    if (isSelectingFile) return;
    setModalOpen(false);
    setEditing(null);
    if (filePreview?.startsWith("blob:")) URL.revokeObjectURL(filePreview);
    fileRef.current = null;
  };

  // File input
  const handleFileTrigger = () => {
    setIsSelectingFile(true);
    fileRef.current?.click();
  };

  const onFileSelected = (files) => {
    const file = files?.[0];
    if (!file) {
      setIsSelectingFile(false);
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
    fileRef.current = file;
    setIsSelectingFile(false);
  };

  const handleImageUrlChange = (url) => {
    setForm(f => ({ ...f, image: url }));
    setFilePreview(imgOrDefault(url));
    fileRef.current = null;
  };

  const uploadFile = async (file) => {
    if (!file) return null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Try upload endpoints
      const endpoints = [
        "/api/uploads",
        "/api/courses/upload-image",
      ];
      for (const url of endpoints) {
        try {
          const res = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
          const uploadedUrl = res?.data?.url || res?.data?.fileUrl || res?.data?.data?.url;
          if (uploadedUrl) return uploadedUrl;
        } catch (err) {
          if (err?.status === 404) continue;
          throw err;
        }
      }
      // Fallback to base64
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error("Upload failed", err);
      toast.error("Image upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!form.course_name?.trim()) {
      setFormErrors({ course_name: "Course name is required" });
      toast.error("Please enter a course name");
      return;
    }

    try {
      let imageUrl = form.image?.trim() || null;
      // If a new file was selected, upload it
      if (fileRef.current) {
        const uploadedUrl = await uploadFile(fileRef.current);
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const payload = {
        course_name: form.course_name.trim(),
        description: form.description?.trim() || null,
        price: form.price ? Number(form.price) : null,
        image: imageUrl,
        medium_id: form.medium_id || null,
        std_id: form.std_id || null,
        book_id: form.book_id || null,
      };

      if (editing?.course_id) {
        await api.put(`/api/courses/${editing.course_id}`, payload);
        toast.success("Course updated");
      } else {
        await api.post("/api/courses", payload);
        toast.success("Course created");
      }

      handleCloseModal();
      fetchCourses();
    } catch (err) {
      console.error("Save course error", err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  // Table columns
  const columns = [
    { Header: "Name", accessor: "course_name" },
    { Header: "Medium", accessor: (r) => r.medium_name || "—" },
    { Header: "Standard", accessor: (r) => r.std_name || "—" },
    { Header: "Book", accessor: (r) => r.book_name || "—" },
    { Header: "Price", accessor: (r) => r.price ? `₹${r.price}` : "—" },
    {
      Header: "Image",
      accessor: (r) => (
        <img
          src={imgOrDefault(r.image)}
          alt={r.course_name}
          className="h-10 w-16 object-cover rounded"
        />
      ),
    },
    {
      Header: "Actions",
      accessor: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleEdit(r)}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            title="Edit"
          >
            <ERPIcons.Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400"
            title="Delete"
          >
            <ERPIcons.Delete className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Courses
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage course catalog – images, pricing, and standard mappings
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OutlineBtn size="sm" onClick={fetchCourses}>
                Reload
              </OutlineBtn>
              <ExportCSV columns={columns} rows={rows} filename={`courses_export_${new Date().toISOString().slice(0,10)}.csv`} />
              <PrimaryBtn size="sm" onClick={handleCreate} leftIcon={ERPIcons.Plus}>
                New Course
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <FormField label="Search">
              <TextInput
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(v) => {
                  setSearchQuery(v);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
            </FormField>
            <FormField label="Medium">
              <Select
                value={fMedium}
                onChange={(v) => { setFMedium(v); setPagination(prev => ({ ...prev, page: 1 })); }}
                options={[
                  { value: "", label: "All Mediums" },
                  ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                ]}
              />
            </FormField>
            <FormField label="Standard">
              <Select
                value={fStd}
                onChange={(v) => { setFStd(v); setPagination(prev => ({ ...prev, page: 1 })); }}
                options={[
                  { value: "", label: "All Standards" },
                  ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                ]}
              />
            </FormField>
            <FormField label="Book">
              <Select
                value={fBook}
                onChange={(v) => { setFBook(v); setPagination(prev => ({ ...prev, page: 1 })); }}
                options={[
                  { value: "", label: "All Books" },
                  ...books.map(b => ({ value: b.book_id, label: b.book_name })),
                ]}
              />
            </FormField>
            <div className="flex items-end gap-2">
              <FormField label="Rows" className="w-24">
                <select
                  value={pagination.pageSize}
                  onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                  className="w-full px-2 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </FormField>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <LoadingCard key={i} variant="detailed" lines={2} />
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <ERPIcons.File className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No courses found</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery || fMedium || fStd || fBook ? "Try adjusting your filters" : "Add your first course to get started"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <SimpleTable columns={columns} data={rows} emptyMessage="No courses found" />
              </div>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </div>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={Math.ceil(pagination.total / pagination.pageSize)}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  showNumbers
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
            onClick={isSelectingFile ? undefined : handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={isSelectingFile ? undefined : handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Modal header */}
              <div className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                <img
                  src={MODAL_HEADER_LOGO}
                  alt="Logo"
                  className="h-10 sm:h-12 w-auto rounded"
                />
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                    {editing ? "Edit Course" : "Create New Course"}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Fill in course details and optional image
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ERPIcons.Close className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              {/* Scrollable form */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Course Name *" required error={formErrors.course_name}>
                    <TextInput
                      value={form.course_name}
                      onChange={(v) => setForm(f => ({ ...f, course_name: v }))}
                      placeholder="Enter course name"
                    />
                  </FormField>
                  <FormField label="Price">
                    <TextInput
                      type="number"
                      value={form.price}
                      onChange={(v) => setForm(f => ({ ...f, price: v }))}
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField label="Medium">
                    <Select
                      value={form.medium_id || ""}
                      onChange={(v) => setForm(f => ({ ...f, medium_id: v }))}
                      options={[
                        { value: "", label: "None" },
                        ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Standard">
                    <Select
                      value={form.std_id || ""}
                      onChange={(v) => setForm(f => ({ ...f, std_id: v }))}
                      options={[
                        { value: "", label: "None" },
                        ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Book">
                    <Select
                      value={form.book_id || ""}
                      onChange={(v) => setForm(f => ({ ...f, book_id: v }))}
                      options={[
                        { value: "", label: "None" },
                        ...books.map(b => ({ value: b.book_id, label: b.book_name })),
                      ]}
                    />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Description">
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white min-h-[100px] resize-y"
                        placeholder="Optional description..."
                      />
                    </FormField>
                  </div>
                </div>

                {/* Image section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormField label="Image URL (or upload)">
                      <TextInput
                        value={form.image || ""}
                        onChange={handleImageUrlChange}
                        placeholder="https://example.com/image.jpg"
                      />
                    </FormField>
                    <div className="mt-3">
                      <FormField label="Upload Image">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => setIsSelectingFile(true)}
                          onChange={(e) => onFileSelected(e.target.files)}
                        />
                        <PrimaryBtn
                          size="sm"
                          onClick={handleFileTrigger}
                          disabled={uploading}
                          leftIcon={ERPIcons.Upload}
                        >
                          Choose File
                        </PrimaryBtn>
                      </FormField>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden w-full">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => e.currentTarget.src = DEFAULT_IMAGE}
                      />
                    </div>
                  </div>
                </div>

                {uploading && (
                  <div className="text-sm text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Uploading image...
                  </div>
                )}

                {/* Form actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <OutlineBtn type="button" onClick={handleCloseModal}>
                    Cancel
                  </OutlineBtn>
                  <PrimaryBtn type="submit" loading={uploading}>
                    {editing ? "Save Changes" : "Create Course"}
                  </PrimaryBtn>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}