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

// Constants
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
  const [bulkAction, setBulkAction] = useState("");
  
  // Search debouncing
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Fetch lookup data
  useEffect(() => {
    fetchLookupData();
  }, []);
  
  // Fetch books when filters or pagination change
  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, filters, debouncedSearch]);
  
  const fetchLookupData = async () => {
    try {
      const [cRes, mRes, sRes] = await Promise.all([
        api.get("/api/courses", { query: { pageSize: 1000 } }),
        api.get("/api/master", { query: { table: "media", pageSize: 1000 } }),
        api.get("/api/master", { query: { table: "standards", pageSize: 1000 } })
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
      const query = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters
      };
      
      if (debouncedSearch) {
        query.search = debouncedSearch;
      }
      
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
      
      // Clear selection if data changes significantly
      if (selectedRows.length > 0) {
        setSelectedRows([]);
      }
      
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
    
    if (!form.book_name.trim()) {
      errors.book_name = "Book name is required";
    }
    
    if (form.price && isNaN(Number(form.price))) {
      errors.price = "Price must be a valid number";
    }
    
    if (form.price && Number(form.price) < 0) {
      errors.price = "Price cannot be negative";
    }
    
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
    if (!window.confirm(`Are you sure you want to delete "${row.book_name}"?`)) {
      return;
    }
    
    try {
      await api.delete(`/api/books/${row.book_id}`);
      toast.success("Book deleted successfully");
      
      // Refresh data
      fetchBooks();
      
      // Track analytics
      trackEvent('book_deleted', { bookId: row.book_id });
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete book. Please try again.");
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedRows.length === 0 || !window.confirm(`Delete ${selectedRows.length} selected books?`)) {
      return;
    }
    
    try {
      await Promise.all(
        selectedRows.map(id => api.delete(`/api/books/${id}`))
      );
      
      toast.success(`Deleted ${selectedRows.length} books successfully`);
      setSelectedRows([]);
      fetchBooks();
      
      trackEvent('bulk_books_deleted', { count: selectedRows.length });
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error("Failed to delete some books. Please try again.");
    }
  };
  
  const handleBulkExport = () => {
    const selectedBooks = rows.filter(row => selectedRows.includes(row.book_id));
    const csvData = selectedBooks.map(book => ({
      'Book Name': book.book_name,
      'Description': book.description || '',
      'Price': book.price ? `₹${book.price}` : '',
      'Course': book.course_name || '',
      'Medium': book.medium_name || '',
      'Standard': book.std_name || '',
      'Image URL': book.image || ''
    }));
    
    // Use ExportCSV logic or custom export
    exportToCSV(csvData, `selected_books_${new Date().toISOString().slice(0, 10)}.csv`);
    trackEvent('bulk_books_exported', { count: selectedBooks.length });
  };
  
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const cell = row[header];
          return typeof cell === 'string' && cell.includes(',') 
            ? `"${cell}"` 
            : cell;
        }).join(',')
      )
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
      
      // Simulate progress (in real app, use axios progress event)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);
      
      let uploadedUrl = null;
      
      try {
        // Try multiple upload endpoints
        const r = await api.post("/api/uploads", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        });
        uploadedUrl = r?.data?.url || r?.data?.fileUrl || null;
      } catch (e) {
        try {
          const r2 = await api.post("/api/books/upload-image", fd, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          uploadedUrl = r2?.data?.url || r2?.data?.fileUrl || null;
        } catch (ee) {
          console.warn("Upload endpoints failed, converting to data URL", ee);
          // Fallback to data URL
          uploadedUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
      } finally {
        clearInterval(progressInterval);
        setUploadProgress(100);
      }
      
      return uploadedUrl;
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload image. Please try again.");
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };
  
  const handleFileSelect = (files) => {
    if (!files || !files.length) return;
    
    const file = files[0];
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    
    fileRef.current = file;
    
    // Create preview
    try {
      const blobUrl = URL.createObjectURL(file);
      setFilePreview(blobUrl);
    } catch (err) {
      console.warn("Failed to create preview:", err);
      setFilePreview(defaultImg);
    }
  };
  
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }
    
    try {
      let imageUrl = form.image?.trim() || null;
      
      // Upload file if selected
      if (fileRef.current) {
        const uploadedUrl = await uploadFile(fileRef.current);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }
      
      const payload = {
        book_name: form.book_name.trim(),
        description: form.description?.trim() || null,
        price: form.price ? Number(form.price) : null,
        image: imageUrl,
        course_id: form.course_id ? Number(form.course_id) : null,
        medium_id: form.medium_id ? Number(form.medium_id) : null,
        std_id: form.std_id ? Number(form.std_id) : null
      };
      
      if (editing?.book_id) {
        await api.put(`/api/books/${editing.book_id}`, payload);
        toast.success("Book updated successfully");
        trackEvent('book_updated', { bookId: editing.book_id });
      } else {
        const res = await api.post("/api/books", payload);
        toast.success("Book created successfully");
        trackEvent('book_created', { bookId: res?.data?.book_id });
      }
      
      // Cleanup
      handleModalClose();
      fetchBooks();
      
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err?.response?.data?.message || "Failed to save book. Please try again.");
    }
  };
  
  const handleModalClose = () => {
    setModalOpen(false);
    setEditing(null);
    
    // Cleanup blob URL
    if (filePreview && filePreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(filePreview);
      } catch (err) {
        console.warn("Failed to revoke blob URL:", err);
      }
    }
    
    fileRef.current = null;
  };
  
  const handleRowSelect = (bookId) => {
    setSelectedRows(prev => 
      prev.includes(bookId)
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedRows.length === rows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(rows.map(row => row.book_id));
    }
  };
  
  const trackEvent = (eventName, properties = {}) => {
    if (window.analytics) {
      window.analytics.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString()
      });
    }
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
    setFilters({
      course_id: "",
      medium_id: "",
      std_id: ""
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Memoized values
  const courseOptions = useMemo(() => 
    [{ value: "", label: "All Courses" }].concat(
      courses.map(c => ({ value: c.course_id, label: c.course_name }))
    ),
    [courses]
  );
  
  const mediumOptions = useMemo(() => 
    [{ value: "", label: "All Mediums" }].concat(
      mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))
    ),
    [mediums]
  );
  
  const standardOptions = useMemo(() => 
    [{ value: "", label: "All Standards" }].concat(
      standards.map(s => ({ value: s.std_id, label: s.std_name }))
    ),
    [standards]
  );
  
  const tableColumns = useMemo(() => [
    {
      Header: (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedRows.length === rows.length}
            onChange={handleSelectAll}
            className="rounded border-slate-300"
          />
          <span>Select</span>
        </div>
      ),
      accessor: (r) => (
        <input
          type="checkbox"
          checked={selectedRows.includes(r.book_id)}
          onChange={() => handleRowSelect(r.book_id)}
          className="rounded border-slate-300"
        />
      ),
      width: 60
    },
    { 
      Header: "Book Name", 
      accessor: "book_name",
      Cell: ({ value }) => (
        <div className="font-medium text-slate-800">{value}</div>
      )
    },
    { 
      Header: "Course", 
      accessor: (r) => r.course_name || "—",
      Cell: ({ value }) => (
        <span className="text-slate-600">{value}</span>
      )
    },
    { 
      Header: "Medium", 
      accessor: (r) => r.medium_name || "—" 
    },
    { 
      Header: "Standard", 
      accessor: (r) => r.std_name || "—" 
    },
    { 
      Header: "Price", 
      accessor: (r) => r.price ? `₹${parseFloat(r.price).toFixed(2)}` : "—",
      Cell: ({ value }) => (
        <span className="font-medium text-emerald-700">{value}</span>
      )
    },
    {
      Header: "Image",
      accessor: (r) => (
        <div className="relative group">
          <img 
            src={imgOrDefault(r.image)} 
            alt={r.book_name}
            className="h-10 w-10 rounded-lg object-cover border border-slate-200"
            loading="lazy"
          />
          {r.image && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <IconBtn
  icon={ERPIcons.Search}
  size="sm"
  className="bg-white/20 text-white"
  onClick={() => window.open(r.image, "_blank")}
/>
            </div>
          )}
        </div>
      )
    },
    {
      Header: "Actions",
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <IconBtn
            icon={ERPIcons.Edit}
            label="Edit"
            size="sm"
            onClick={() => handleEdit(r)}
            className="hover:bg-slate-100"
          />
          <IconBtn
            icon={ERPIcons.Delete}
            label="Delete"
            size="sm"
            onClick={() => handleDelete(r)}
            className="hover:bg-rose-50 hover:text-rose-600"
          />
          <IconBtn
  icon={ERPIcons.Eye}
  label="View"
  size="sm"
  onClick={() => window.open(`/books/${r.book_id}`, "_blank")}
/>

        </div>
      )
    }
  ], [rows, selectedRows, handleEdit, handleDelete]);
  
  // Show loading skeleton
  if (loading && rows.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <LoadingCard key={i} variant="detailed" lines={2} />
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6">
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Books Management
              </h1>
              <p className="text-slate-600 mt-2">
                Manage books, link to courses, mediums, and standards with image uploads
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <ExportCSV 
                columns={tableColumns.filter((_, i) => i !== 0 && i !== tableColumns.length - 1)} 
                rows={rows} 
                filename={`books_export_${new Date().toISOString().slice(0,10)}.csv`}
              />
              
              {selectedRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    {selectedRows.length} selected
                  </span>
                  <DangerBtn
                    size="sm"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2"
                  >
                    <ERPIcons.Delete className="w-4 h-4" />
                    Delete Selected
                  </DangerBtn>
                  <OutlineBtn
                  onClick={handleBulkExport}
                  leftIcon={ERPIcons.DownloadCloud}
                >
                  </OutlineBtn>

                </div>
              )}
              
              <PrimaryBtn
                onClick={handleCreate}
                className="flex items-center gap-2"
              >
                <ERPIcons.Plus className="w-5 h-5" />
                Add New Book
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>
        
        {/* Filters Card */}
        <Card className="mb-6" elevated>
          <CardHeader
            title="Filters & Search"
            subtitle="Filter books by different criteria"
            icon={ERPIcons.Filter}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label="Search Books">
                <SearchInput
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                />
              </FormField>
              
              <FormField label="Course">
                <Select
                  value={filters.course_id}
                  onChange={(v) => handleFilterChange('course_id', v)}
                  options={courseOptions}
                  className="w-full"
                />
              </FormField>
              
              <FormField label="Medium">
                <Select
                  value={filters.medium_id}
                  onChange={(v) => handleFilterChange('medium_id', v)}
                  options={mediumOptions}
                  className="w-full"
                />
              </FormField>
              
              <FormField label="Standard">
                <Select
                  value={filters.std_id}
                  onChange={(v) => handleFilterChange('std_id', v)}
                  options={standardOptions}
                  className="w-full"
                />
              </FormField>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <div className="text-sm text-slate-500">
                {pagination.total} books found
              </div>
              
              <div className="flex items-center gap-2">
                <OutlineBtn onClick={handleResetFilters} leftIcon={ERPIcons.Refresh}>
  Reset Filters
</OutlineBtn>


                
                <SecondaryBtn
                  onClick={fetchBooks}
                  className="flex items-center gap-2"
                >
                  <ERPIcons.Refresh className="w-4 h-4" />
                  Refresh
                </SecondaryBtn>
              </div>
            </div>
          </CardBody>
        </Card>
        
        {/* Books Table Card */}
        <Card elevated>
          <CardHeader
            title="Books"
            subtitle={`Showing ${rows.length} of ${pagination.total} books`}
            icon={ERPIcons.File}
            actions={
              <div className="flex items-center gap-3">
                <FormField label="Rows per page">
                  <select
                    value={pagination.pageSize}
                    onChange={(e) => setPagination(prev => ({ 
                      ...prev, 
                      pageSize: Number(e.target.value),
                      page: 1 
                    }))}
                    className="px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            }
          />
          
          <CardBody className="p-0">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-flex flex-col items-center gap-4">
                  <svg className="animate-spin w-8 h-8 text-slate-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <p className="text-slate-500">Loading books...</p>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex flex-col items-center gap-4 max-w-md">
                  <ERPIcons.File className="w-16 h-16 text-slate-300" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No books found</h3>
                    <p className="text-slate-500 mb-6">
                      {searchQuery || Object.values(filters).some(Boolean)
                        ? "Try adjusting your search or filters"
                        : "Get started by adding your first book"
                      }
                    </p>
                    {!searchQuery && Object.values(filters).every(v => !v) && (
                      <PrimaryBtn onClick={handleCreate}>
                        Add Your First Book
                      </PrimaryBtn>
                    )}
                  </div>
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
                
                <CardFooter align="between">
                  <div className="text-sm text-slate-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                    showNumbers={true}
                    className="flex items-center gap-1"
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

// Book Modal Component
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
  headerLogo
}) => {
  const [localImageUrl, setLocalImageUrl] = useState(form.image || "");
  
  const handleLocalUrlChange = (url) => {
    setLocalImageUrl(url);
    onImageUrlChange(url);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-4">
            <img 
              src={headerLogo} 
              alt="Logo" 
              className="h-12 w-12 rounded-lg object-contain"
              onError={(e) => { e.target.src = headerLogo; }}
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {editing ? "Edit Book" : "Add New Book"}
              </h2>
              <p className="text-slate-600 text-sm">
                {editing ? "Update book details" : "Fill in the book information"}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <ERPIcons.Close className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Column - Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              <FormField 
                label="Book Name" 
                required
                error={formErrors.book_name}
              >
                <TextInput
                  value={form.book_name}
                  onChange={(v) => onFormChange({ ...form, book_name: v })}
                  placeholder="Enter book name"
                  className="w-full"
                />
              </FormField>
              
              <FormField 
                label="Description"
                help="Provide a brief description of the book"
              >
                <textarea
                  value={form.description}
                  onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md min-h-[120px] resize-y"
                  placeholder="Enter book description..."
                />
              </FormField>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Price" error={formErrors.price}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
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
                    options={[{ value: "", label: "Select Course" }, ...courses.map(c => ({
                      value: c.course_id,
                      label: c.course_name
                    }))]}
                    className="w-full"
                  />
                </FormField>
                
                <FormField label="Medium">
                  <Select
                    value={form.medium_id || ""}
                    onChange={(v) => onFormChange({ ...form, medium_id: v })}
                    options={[{ value: "", label: "Select Medium" }, ...mediums.map(m => ({
                      value: m.medium_id,
                      label: m.medium_name
                    }))]}
                    className="w-full"
                  />
                </FormField>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Standard">
                  <Select
                    value={form.std_id || ""}
                    onChange={(v) => onFormChange({ ...form, std_id: v })}
                    options={[{ value: "", label: "Select Standard" }, ...standards.map(s => ({
                      value: s.std_id,
                      label: s.std_name
                    }))]}
                    className="w-full"
                  />
                </FormField>
                
                <FormField 
                  label="Image URL"
                  help="Or paste an image URL directly"
                >
                  <TextInput
                    value={localImageUrl}
                    onChange={handleLocalUrlChange}
                    placeholder="https://example.com/image.jpg"
                    className="w-full"
                  />
                </FormField>
              </div>
            </div>
            
            {/* Right Column - Image Preview & Upload */}
            <div className="space-y-6">
              <FormField label="Upload Image">
                <FileInput
                  accept="image/*"
                  onChange={onFileSelect}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Supports JPG, PNG, GIF (max 5MB)
                </p>
              </FormField>
              
              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Image Preview */}
              <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white">
                <h3 className="font-medium text-slate-700 mb-4">Preview</h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={filePreview}
                      alt="Book preview"
                      className="w-full h-48 object-cover rounded-lg border border-slate-200"
                      onError={(e) => {
                        e.target.src = defaultImg;
                      }}
                    />
                    
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => {
                          onImageUrlChange("");
                          setLocalImageUrl("");
                        }}
                        className="p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white"
                      >
                        <ERPIcons.Close className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {form.book_name || "Untitled Book"}
                      </span>
                      {form.price && (
                        <span className="text-sm font-bold text-emerald-700">
                          ₹{parseFloat(form.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    {form.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {form.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{form.course_id ? "Course Linked" : "No Course"}</span>
                      <span>•</span>
                      <span>{form.medium_id ? "Medium Set" : "No Medium"}</span>
                      <span>•</span>
                      <span>{form.std_id ? "Standard Set" : "No Standard"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Help Text */}
              <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                <p className="font-medium mb-1">Tips:</p>
                <ul className="space-y-1">
                  <li>• Upload or paste an image URL for the book cover</li>
                  <li>• Fill in pricing for accurate inventory tracking</li>
                  <li>• Link to course/medium/standard for better organization</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50/50">
            <div className="text-sm text-slate-500">
              {editing ? "Update book details" : "Create a new book entry"}
            </div>
            
            <div className="flex items-center gap-3">
              <OutlineBtn
                type="button"
                onClick={onClose}
                className="px-6"
              >
                Cancel
              </OutlineBtn>
              
              <PrimaryBtn
                type="submit"
                className="px-6 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <ERPIcons.Save className="w-4 h-4" />
                    {editing ? "Save Changes" : "Create Book"}
                  </>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};