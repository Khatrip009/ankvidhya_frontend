// src/pages/books.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import ERPIcons from "../components/icons.jsx";
import { FormField, TextInput, Select, FileInput, SearchInput } from "../components/input.jsx";
import { SimpleTable, ExportCSV, Pagination } from "../components/table.jsx";
import { PrimaryBtn, SecondaryBtn, DangerBtn, OutlineBtn, IconBtn } from "../components/buttons.jsx";
import { Card, CardHeader, CardBody, CardFooter, LoadingCard } from "../components/cards.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useDebounce } from "../hooks/useDebounce.jsx";

const defaultImg = "/images/placeholder.png";
const headerLogo = "/images/Ank_Logo.png";

const imgOrDefault = (url) => (url && String(url).trim()) ? url : defaultImg;

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function BooksPage() {
  const toast = useToast();

  // Data states
  const [courses, setCourses] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    course_id: "",
    medium_id: "",
    std_id: ""
  });

  // Modal & form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    book_id: null,
    book_name: "",
    description: "",
    price: "",
    course_id: "",
    medium_id: "",
    std_id: "",
    image: ""
  });
  const [formErrors, setFormErrors] = useState({});

  // File upload states
  const fileRef = useRef(null);
  const [filePreview, setFilePreview] = useState(defaultImg);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Bulk operations
  const [selectedRows, setSelectedRows] = useState([]);

  // Search debouncing
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch lookup data
  useEffect(() => {
    fetchLookupData();
  }, []);

  // Fetch books when filters, pagination or search change
  useEffect(() => {
    fetchBooks();
  }, [pagination.page, pagination.pageSize, filters, debouncedSearch]);

  const fetchLookupData = async () => {
    try {
      const [cRes, mRes, sRes] = await Promise.all([
        api.get("/api/courses", { query: { pageSize: 1000 } }),
        api.get("/api/master", { query: { table: "media", pageSize: 1000 } }),
        api.get("/api/master", { query: { table: "standards", pageSize: 1000 } }),
      ]);
      setCourses(cRes?.data || []);
      setMediums(mRes?.data || []);
      setStandards(sRes?.data || []);
    } catch (err) {
      console.error("Failed to load lookup data:", err);
      toast.error("Failed to load dropdown options");
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const query = { page: pagination.page, pageSize: pagination.pageSize, ...filters };
      if (debouncedSearch) query.search = debouncedSearch;

      const res = await api.get("/api/books", { query });
      const data = res?.data || [];
      const pg = res?.pagination || {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pagination.pageSize)
      };

      setRows(data);
      setPagination(prev => ({
        ...prev,
        ...pg,
        totalPages: pg.totalPages || Math.ceil(pg.total / pg.pageSize)
      }));

      if (selectedRows.length > 0) setSelectedRows([]);
    } catch (err) {
      console.error("Failed to fetch books:", err);
      toast.error("Failed to load books. Please try again.");
      setRows([]);
      setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.book_name.trim()) errors.book_name = "Book name is required";
    if (form.price && isNaN(Number(form.price))) errors.price = "Price must be a valid number";
    if (form.price && Number(form.price) < 0) errors.price = "Price cannot be negative";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    setEditing(null);
    setForm({
      book_id: null,
      book_name: "",
      description: "",
      price: "",
      course_id: "",
      medium_id: "",
      std_id: "",
      image: ""
    });
    setFormErrors({});
    fileRef.current = null;
    setFilePreview(defaultImg);
    setModalOpen(true);
  };

  const handleEdit = useCallback((row) => {
    setEditing(row);
    setForm({
      book_id: row.book_id || null,
      book_name: row.book_name || "",
      description: row.description || "",
      price: row.price ?? "",
      course_id: row.course_id ?? "",
      medium_id: row.medium_id ?? "",
      std_id: row.std_id ?? "",
      image: row.image || ""
    });
    setFormErrors({});
    fileRef.current = null;
    setFilePreview(imgOrDefault(row.image));
    setModalOpen(true);
  }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.book_name}"?`)) return;
    try {
      await api.delete(`/api/books/${row.book_id}`);
      toast.success("Book deleted");
      fetchBooks();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete book");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0 || !window.confirm(`Delete ${selectedRows.length} selected books?`)) return;
    try {
      await Promise.all(selectedRows.map(id => api.delete(`/api/books/${id}`)));
      toast.success(`Deleted ${selectedRows.length} books`);
      setSelectedRows([]);
      fetchBooks();
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error("Failed to delete some books");
    }
  };

  const handleBulkExport = () => {
    const selectedBooks = rows.filter(r => selectedRows.includes(r.book_id));
    const csvData = selectedBooks.map(book => ({
      'Book Name': book.book_name,
      'Description': book.description || '',
      'Price': book.price ? `₹${book.price}` : '',
      'Course': book.course_name || '',
      'Medium': book.medium_name || '',
      'Standard': book.std_name || '',
      'Image URL': book.image || ''
    }));
    exportToCSV(csvData, `selected_books_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportToCSV = (data, filename) => {
    if (!data?.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const cell = row[h];
        return (typeof cell === 'string' && cell.includes(',')) ? `"${cell}"` : cell;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const uploadFile = async (file) => {
    if (!file) return null;
    setUploading(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const progressInterval = setInterval(() => setUploadProgress(prev => Math.min(prev + 10, 90)), 100);
      let uploadedUrl = null;
      try {
        const r = await api.post("/api/uploads", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total))
        });
        uploadedUrl = r?.data?.url || r?.data?.fileUrl;
      } catch {
        try {
          const r2 = await api.post("/api/books/upload-image", fd, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          uploadedUrl = r2?.data?.url || r2?.data?.fileUrl;
        } catch {
          uploadedUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
      }
      clearInterval(progressInterval);
      setUploadProgress(100);
      return uploadedUrl;
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Image upload failed");
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleFileSelect = (files) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    fileRef.current = file;
    setFilePreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }
    try {
      let imageUrl = form.image?.trim() || null;
      if (fileRef.current) {
        const uploadedUrl = await uploadFile(fileRef.current);
        if (uploadedUrl) imageUrl = uploadedUrl;
      }
      const payload = {
        book_name: form.book_name.trim(),
        description: form.description?.trim() || null,
        price: form.price ? Number(form.price) : null,
        image: imageUrl,
        course_id: form.course_id ? Number(form.course_id) : null,
        medium_id: form.medium_id ? Number(form.medium_id) : null,
        std_id: form.std_id ? Number(form.std_id) : null,
      };
      if (editing?.book_id) {
        await api.put(`/api/books/${editing.book_id}`, payload);
        toast.success("Book updated");
      } else {
        await api.post("/api/books", payload);
        toast.success("Book created");
      }
      handleModalClose();
      fetchBooks();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.response?.data?.message || "Failed to save book");
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditing(null);
    if (filePreview?.startsWith("blob:")) URL.revokeObjectURL(filePreview);
    fileRef.current = null;
  };

  const handleRowSelect = (bookId) => {
    setSelectedRows(prev => prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId]);
  };

  const handleSelectAll = () => {
    if (selectedRows.length === rows.length) setSelectedRows([]);
    else setSelectedRows(rows.map(r => r.book_id));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilters({ course_id: "", medium_id: "", std_id: "" });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Memoized dropdown options
  const courseOptions = useMemo(() =>
    [{ value: "", label: "All Courses" }].concat(courses.map(c => ({ value: c.course_id, label: c.course_name }))),
    [courses]
  );
  const mediumOptions = useMemo(() =>
    [{ value: "", label: "All Mediums" }].concat(mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))),
    [mediums]
  );
  const standardOptions = useMemo(() =>
    [{ value: "", label: "All Standards" }].concat(standards.map(s => ({ value: s.std_id, label: s.std_name }))),
    [standards]
  );

  // Table columns
  const tableColumns = useMemo(() => [
    {
      Header: (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedRows.length === rows.length}
            onChange={handleSelectAll}
            className="rounded border-slate-300 dark:border-slate-600"
          />
          <span>Select</span>
        </div>
      ),
      accessor: (r) => (
        <input
          type="checkbox"
          checked={selectedRows.includes(r.book_id)}
          onChange={() => handleRowSelect(r.book_id)}
          className="rounded border-slate-300 dark:border-slate-600"
        />
      ),
      width: 60
    },
    { Header: "Book Name", accessor: "book_name" },
    { Header: "Course", accessor: (r) => r.course_name || "—" },
    { Header: "Medium", accessor: (r) => r.medium_name || "—" },
    { Header: "Standard", accessor: (r) => r.std_name || "—" },
    {
      Header: "Price",
      accessor: (r) => r.price ? `₹${parseFloat(r.price).toFixed(2)}` : "—",
      Cell: ({ value }) => <span className="font-medium text-emerald-600 dark:text-emerald-400">{value}</span>
    },
    {
      Header: "Image",
      accessor: (r) => (
        <div className="relative group">
          <img
            src={imgOrDefault(r.image)}
            alt={r.book_name}
            className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            loading="lazy"
          />
          {r.image && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); window.open(r.image, "_blank"); }}
                className="p-1 bg-white/20 text-white rounded"
              >
                <ERPIcons.Search className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      Header: "Actions",
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <IconBtn icon={ERPIcons.Edit} label="Edit" size="sm" onClick={() => handleEdit(r)} />
          <IconBtn icon={ERPIcons.Delete} label="Delete" size="sm" onClick={() => handleDelete(r)} className="hover:bg-rose-50 dark:hover:bg-rose-900/20" />
          <IconBtn icon={ERPIcons.Eye} label="View" size="sm" onClick={() => window.open(`/books/${r.book_id}`, "_blank")} />
        </div>
      )
    }
  ], [rows, selectedRows, handleEdit, handleDelete]);

  // Loading skeleton state
  if (loading && rows.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <LoadingCard key={i} variant="detailed" lines={2} />
            ))}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-4 lg:p-6 transition-colors">
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                Books Management
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Manage books, link to courses, mediums, and standards with image uploads
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <ExportCSV
                columns={tableColumns.filter((_, i) => i !== 0 && i !== tableColumns.length - 1)}
                rows={rows}
                filename={`books_export_${new Date().toISOString().slice(0, 10)}.csv`}
              />
              {selectedRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{selectedRows.length} selected</span>
                  <DangerBtn size="sm" onClick={handleBulkDelete}>Delete Selected</DangerBtn>
                  <OutlineBtn size="sm" onClick={handleBulkExport}>Export Selected</OutlineBtn>
                </div>
              )}
              <PrimaryBtn onClick={handleCreate} leftIcon={ERPIcons.Plus}>Add New Book</PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <Card elevated className="mb-4 sm:mb-6 dark:bg-slate-800 dark:border-slate-700">
          <CardHeader title="Filters & Search" subtitle="Filter books by different criteria" />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField label="Search Books">
                <SearchInput
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                />
              </FormField>
              <FormField label="Course">
                <Select value={filters.course_id} onChange={(v) => handleFilterChange('course_id', v)} options={courseOptions} className="w-full" />
              </FormField>
              <FormField label="Medium">
                <Select value={filters.medium_id} onChange={(v) => handleFilterChange('medium_id', v)} options={mediumOptions} className="w-full" />
              </FormField>
              <FormField label="Standard">
                <Select value={filters.std_id} onChange={(v) => handleFilterChange('std_id', v)} options={standardOptions} className="w-full" />
              </FormField>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{pagination.total} books found</div>
              <div className="flex items-center gap-2">
                <OutlineBtn size="sm" onClick={handleResetFilters} leftIcon={ERPIcons.Refresh}>Reset Filters</OutlineBtn>
                <SecondaryBtn size="sm" onClick={fetchBooks} leftIcon={ERPIcons.Refresh}>Refresh</SecondaryBtn>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Books Table */}
        <Card elevated className="dark:bg-slate-800 dark:border-slate-700">
          <CardHeader
            title="Books"
            subtitle={`Showing ${rows.length} of ${pagination.total} books`}
            actions={
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Rows:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                  className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
            }
          />
          <CardBody className="p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading books...</div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <ERPIcons.File className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No books found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {searchQuery || Object.values(filters).some(Boolean) ? "Adjust your filters" : "Add your first book"}
                    </p>
                  </div>
                  {!searchQuery && Object.values(filters).every(v => !v) && (
                    <PrimaryBtn onClick={handleCreate}>Add First Book</PrimaryBtn>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <SimpleTable
                    columns={tableColumns}
                    data={rows}
                    emptyMessage="No books found"
                    className="min-w-full"
                  />
                </div>
                <CardFooter align="between" className="border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                    showNumbers={true}
                  />
                </CardFooter>
              </>
            )}
          </CardBody>
        </Card>
      </main>

      {/* Book Modal */}
      <AnimatePresence>
        {modalOpen && (
          <BookModal
            editing={editing}
            form={form}
            formErrors={formErrors}
            filePreview={filePreview}
            uploading={uploading}
            uploadProgress={uploadProgress}
            courses={courses}
            mediums={mediums}
            standards={standards}
            onClose={handleModalClose}
            onSave={handleSave}
            onFormChange={setForm}
            onFileSelect={handleFileSelect}
            onImageUrlChange={(url) => {
              setForm(prev => ({ ...prev, image: url }));
              setFilePreview(imgOrDefault(url));
              fileRef.current = null;
            }}
            headerLogo={headerLogo}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Book Modal Component (dedicated)
const BookModal = ({
  editing,
  form,
  formErrors,
  filePreview,
  uploading,
  uploadProgress,
  courses,
  mediums,
  standards,
  onClose,
  onSave,
  onFormChange,
  onFileSelect,
  onImageUrlChange,
  headerLogo,
}) => {
  const [localImageUrl, setLocalImageUrl] = useState(form.image || "");

  useEffect(() => {
    setLocalImageUrl(form.image || "");
  }, [form.image]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={headerLogo}
              alt="Logo"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain"
            />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {editing ? "Edit Book" : "Add New Book"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {editing ? "Update book details" : "Fill in book information"}
              </p>
            </div>
          </div>
          <IconBtn icon={ERPIcons.Close} onClick={onClose} className="text-slate-500 dark:text-slate-400" />
        </div>

        {/* Body */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-4">
              <FormField label="Book Name" required error={formErrors.book_name}>
                <TextInput
                  value={form.book_name}
                  onChange={(v) => onFormChange({ ...form, book_name: v })}
                  placeholder="Enter book name"
                  className="w-full"
                />
              </FormField>
              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-h-[100px] resize-y"
                  placeholder="Brief description..."
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Price" error={formErrors.price}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">₹</span>
                    <TextInput
                      type="number"
                      value={form.price}
                      onChange={(v) => onFormChange({ ...form, price: v })}
                      placeholder="0.00"
                      className="w-full pl-8"
                    />
                  </div>
                </FormField>
                <FormField label="Course">
                  <Select
                    value={form.course_id || ""}
                    onChange={(v) => onFormChange({ ...form, course_id: v })}
                    options={[{ value: "", label: "Select Course" }, ...courses.map(c => ({ value: c.course_id, label: c.course_name }))]}
                    className="w-full"
                  />
                </FormField>
                <FormField label="Medium">
                  <Select
                    value={form.medium_id || ""}
                    onChange={(v) => onFormChange({ ...form, medium_id: v })}
                    options={[{ value: "", label: "Select Medium" }, ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))]}
                    className="w-full"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Standard">
                  <Select
                    value={form.std_id || ""}
                    onChange={(v) => onFormChange({ ...form, std_id: v })}
                    options={[{ value: "", label: "Select Standard" }, ...standards.map(s => ({ value: s.std_id, label: s.std_name }))]}
                    className="w-full"
                  />
                </FormField>
                <FormField label="Image URL" help="Paste an image URL directly">
                  <TextInput
                    value={localImageUrl}
                    onChange={(v) => {
                      setLocalImageUrl(v);
                      onImageUrlChange(v);
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full"
                  />
                </FormField>
              </div>
            </div>

            {/* Right Column - Image & Upload */}
            <div className="space-y-4">
              <FormField label="Upload Image">
                <FileInput accept="image/*" onChange={onFileSelect} className="w-full" />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">JPG, PNG, GIF (max 5MB)</p>
              </FormField>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-750">
                <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-3">Preview</h3>
                <div className="relative mb-3">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-full h-40 sm:h-48 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    onError={(e) => { e.target.src = defaultImg; }}
                  />
                  <button
                    type="button"
                    onClick={() => onImageUrlChange("")}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm hover:bg-white dark:hover:bg-slate-900"
                  >
                    <ERPIcons.Close className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-slate-800 dark:text-slate-200">{form.book_name || "Untitled"}</div>
                  {form.price && <div className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{parseFloat(form.price).toFixed(2)}</div>}
                  {form.description && <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{form.description}</p>}
                </div>
              </div>

              {/* Tips */}
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
                <p className="font-medium mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Upload or paste an image URL for cover</li>
                  <li>Set price for inventory tracking</li>
                  <li>Link to course/medium/standard for organization</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {editing ? "Update book details" : "Create a new book entry"}
            </div>
            <div className="flex items-center gap-3">
              <OutlineBtn type="button" onClick={onClose} size="sm">Cancel</OutlineBtn>
              <PrimaryBtn type="submit" size="sm" disabled={uploading} leftIcon={uploading ? null : ERPIcons.Save}>
                {uploading ? "Saving..." : editing ? "Save Changes" : "Create Book"}
              </PrimaryBtn>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};