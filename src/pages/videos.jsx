// src/pages/videos.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import ERPIcons from "../components/icons.jsx";
import { FormField, TextInput, Select } from "../components/input.jsx";
import {
  PrimaryBtn,
  SecondaryBtn,
  OutlineBtn,
  DangerBtn,
  IconBtn,
} from "../components/buttons.jsx";
import { ExportCSV, Pagination } from "../components/table.jsx";
import { LoadingCard } from "../components/cards.jsx";
import { useToast } from "../hooks/useToast.jsx";

// ---------- Constants ----------
const DEFAULT_IMAGE = "/images/placeholder.png";
const LOGO = "/images/Ank_Logo.png";
const AUTO_SAVE_DERIVED_THUMBS = true;

// ---------- Helpers ----------
const isDirectVideo = (url) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
const isYouTube = (url) => /youtu\.be\/|youtube\.com\/(watch|embed)/i.test(url);
const isVimeo = (url) => /vimeo\.com\/(video\/)?\d+/i.test(url);
const isGoogleDrive = (url) => /drive\.google\.com/i.test(url);

const getYouTubeId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = url.match(/embed\/(.+?)(\?|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
};

const youTubeThumbnail = (url) => {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

const vimeoThumbnail = async (url) => {
  try {
    const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembed);
    if (res.ok) {
      const json = await res.json();
      return json?.thumbnail_url || null;
    }
    return null;
  } catch {
    return null;
  }
};

const driveThumbnail = (url) => {
  const m = url.match(/\/file\/d\/([^/]+)\//);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}` : null;
};

const generatePosterFromVideo = (url) =>
  new Promise((resolve) => {
    if (!isDirectVideo(url)) return resolve(null);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.src = url;
    let resolved = false;

    const cleanup = () => {
      try { video.pause(); } catch {}
      try { video.removeAttribute("src"); } catch {}
      try { video.load && video.load(); } catch {}
    };

    video.addEventListener("loadedmetadata", () => {
      const seekTo = Math.min(1, Math.floor(video.duration / 2) || 0);
      const onSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg");
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(dataUrl);
          }
        } catch {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(null);
          }
        }
      };

      const timeout = setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 4000);

      video.addEventListener("seeked", function s() {
        clearTimeout(timeout);
        onSeeked();
        video.removeEventListener("seeked", s);
      });

      try {
        video.currentTime = seekTo;
      } catch {
        onSeeked();
      }
    });

    video.addEventListener("error", () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 7000);
  });

const deriveThumbnail = async (link) => {
  if (!link) return null;
  if (isYouTube(link)) return youTubeThumbnail(link);
  if (isVimeo(link)) return await vimeoThumbnail(link);
  if (isGoogleDrive(link)) return driveThumbnail(link);
  if (isDirectVideo(link)) return await generatePosterFromVideo(link);
  return null;
};

// ---------- Main Component ----------
export default function VideosPage() {
  const toast = useToast();

  // Lookups
  const [courses, setCourses] = useState([]);
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [lookupsFailed, setLookupsFailed] = useState(false);

  // Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 24, total: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fBook, setFBook] = useState("");
  const [fChapter, setFChapter] = useState("");

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    video_id: null,
    tittle: "",
    title: "",
    video_link: "",
    description: "",
    course_id: "",
    book_id: "",
    chapter_id: "",
  });
  const [thumbnailPreview, setThumbnailPreview] = useState(DEFAULT_IMAGE);

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerHtml, setPlayerHtml] = useState("");
  const [playerTitle, setPlayerTitle] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const fileInputRef = useRef(null);

  const debounceTimer = useRef(null);

  // Load lookups
  useEffect(() => {
    (async () => {
      try {
        const [cRes, bRes, chRes] = await Promise.all([
          api.get("/api/courses", { params: { pageSize: 1000 } }),
          api.get("/api/books", { params: { pageSize: 1000 } }),
          api.get("/api/chapters", { params: { pageSize: 1000 } }),
        ]);
        setCourses(cRes?.data || []);
        setBooks(bRes?.data || []);
        setChapters(chRes?.data || []);
        setLookupsFailed(false);
      } catch (err) {
        console.error("Lookup load failed", err);
        toast.error("Failed to load dropdown data");
        setLookupsFailed(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch videos
  const fetchVideos = useCallback(
    async (
      page = 1,
      pageSize = pagination.pageSize,
      s = search,
      course = fCourse,
      book = fBook,
      chapter = fChapter
    ) => {
      setLoading(true);
      try {
        const params = { page, pageSize };
        if (s) params.search = s;
        if (course) params.course_id = course;
        if (book) params.book_id = book;
        if (chapter) params.chapter_id = chapter;

        const res = await api.get("/api/videos", { params });
        let data = res?.data || [];
        const pg = res?.pagination || { page, pageSize, total: data.length };

        // Normalize title/thumbnail
        data = data.map((r) => {
          const title = r.tittle || r.title || "";
          const immediateThumb = r.thumbnail || youTubeThumbnail(r.video_link) || null;
          return { ...r, displayTitle: title, tittle: title, title, thumbnail: immediateThumb, _deriving: false };
        });

        setRows(data);
        setPagination({ page: pg.page, pageSize: pg.pageSize, total: pg.total });

        // Async derive missing thumbnails
        (async () => {
          for (const r of data) {
            if (r.thumbnail || !r.video_link) continue;
            setRows((prev) =>
              prev.map((p) => (p.video_id === r.video_id ? { ...p, _deriving: true } : p))
            );
            const derived = await deriveThumbnail(r.video_link);
            if (derived) {
              setRows((prev) =>
                prev.map((p) =>
                  p.video_id === r.video_id ? { ...p, thumbnail: derived, _deriving: false } : p
                )
              );
              if (AUTO_SAVE_DERIVED_THUMBS) {
                try {
                  await api.put(`/api/videos/${r.video_id}`, {
                    thumbnail: derived,
                    tittle: r.tittle,
                    title: r.title,
                  });
                } catch (e) { /* silent */ }
              }
            } else {
              setRows((prev) =>
                prev.map((p) =>
                  p.video_id === r.video_id ? { ...p, _deriving: false } : p
                )
              );
            }
          }
        })();
      } catch (err) {
        console.error("Fetch videos failed", err);
        toast.error("Failed to load videos");
      } finally {
        setLoading(false);
      }
    },
    [search, fCourse, fBook, fChapter, toast]
  );

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPagination((p) => ({ ...p, page: 1 }));
      fetchVideos(1, pagination.pageSize, search, fCourse, fBook, fChapter);
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on filter/pagination change
  useEffect(() => {
    fetchVideos(pagination.page, pagination.pageSize, search, fCourse, fBook, fChapter);
  }, [pagination.page, pagination.pageSize, fCourse, fBook, fChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Editor Helpers -----
  const openEditor = (row = null) => {
    if (row) {
      setEditing(row);
      setForm({
        video_id: row.video_id || null,
        tittle: row.tittle || row.title || "",
        title: row.title || row.tittle || "",
        video_link: row.video_link || "",
        description: row.description || "",
        course_id: row.course_id || "",
        book_id: row.book_id || "",
        chapter_id: row.chapter_id || "",
      });
      setThumbnailPreview(row.thumbnail || DEFAULT_IMAGE);
    } else {
      setEditing(null);
      setForm({
        video_id: null,
        tittle: "",
        title: "",
        video_link: "",
        description: "",
        course_id: "",
        book_id: "",
        chapter_id: "",
      });
      setThumbnailPreview(DEFAULT_IMAGE);
    }
    setEditorOpen(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const titleVal = (form.tittle || form.title || "").trim();
    if (!titleVal) {
      toast.error("Title is required");
      return;
    }

    try {
      let thumbnailUrl = null;
      if (form.video_link) {
        thumbnailUrl = await deriveThumbnail(form.video_link);
      }

      const payload = {
        tittle: titleVal,
        title: titleVal,
        video_link: (form.video_link || "").trim() || null,
        description: (form.description || "").trim() || null,
        course_id: form.course_id ? Number(form.course_id) : null,
        book_id: form.book_id ? Number(form.book_id) : null,
        chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
        thumbnail: thumbnailUrl || null,
      };

      if (editing?.video_id) {
        await api.put(`/api/videos/${editing.video_id}`, payload);
        toast.success("Video updated");
      } else {
        await api.post("/api/videos", payload);
        toast.success("Video created");
      }

      setEditorOpen(false);
      setEditing(null);
      fetchVideos(1, pagination.pageSize, search, fCourse, fBook, fChapter);
    } catch (err) {
      console.error("Save video error", err);
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this video?")) return;
    try {
      await api.delete(`/api/videos/${row.video_id}`);
      toast.success("Video deleted");
      fetchVideos(pagination.page, pagination.pageSize, search, fCourse, fBook, fChapter);
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Delete failed");
    }
  };

  // ----- Player -----
  const openPlayer = (row) => {
    const link = row.video_link || "";
    setPlayerTitle(row.tittle || row.title || "Video");
    setPlayerHtml(makePlayerHtml(link, row.tittle || row.title || "Video"));
    setPlayerOpen(true);
  };

  const makePlayerHtml = (link, title) => {
    if (!link) return `<div class="p-4 text-gray-500">No video link</div>`;
    if (isDirectVideo(link)) {
      return `
        <video controls playsinline preload="metadata"
          style="width:100%;max-height:70vh;border-radius:8px;background:#000">
          <source src="${link}">
          Your browser does not support the video tag.
        </video>`;
    }
    let src = link;
    if (isYouTube(link)) src = youTubeEmbed(link);
    else if (isVimeo(link)) src = vimeoEmbed(link);
    else if (isGoogleDrive(link)) src = driveEmbed(link);
    return `
      <div style="position:relative;padding-top:56.25%">
        <iframe src="${src}" title="${title.replace(/"/g, "")}"
          style="position:absolute;left:0;top:0;width:100%;height:100%;border:0;border-radius:8px;"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen>
        </iframe>
      </div>`;
  };

  const youTubeEmbed = (url) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      return url.replace("/watch?v=", "/embed/");
    } catch {
      return url;
    }
  };
  const vimeoEmbed = (url) => {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  };
  const driveEmbed = (url) => {
    const m = url.match(/\/file\/d\/([^/]+)\//);
    return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
  };

  // ----- Import CSV -----
  const parseCSVQuick = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const parseRow = (line) => {
      const out = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; continue; }
          inQuote = !inQuote;
          continue;
        }
        if (!inQuote && ch === ",") { out.push(cur); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = parseRow(lines[0]).map((h) => h.toLowerCase());
    const preview = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const row = parseRow(lines[i]);
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j] !== undefined ? row[j] : "";
      preview.push(obj);
    }
    return preview;
  };

  const onImportFileSelected = async (files) => {
    if (!files?.length) return;
    const file = files[0];
    try {
      const text = await file.text();
      setImportText(text);
      setImportPreviewRows(parseCSVQuick(text));
    } catch {
      toast.error("Failed to read file");
    }
  };

  const submitImport = async () => {
    const text = importText.trim();
    if (!text) { toast.error("CSV content required"); return; }
    try {
      await api.post("/api/videos/import", { csv: text });
      toast.success("CSV imported successfully");
      setImportOpen(false);
      setImportText("");
      setImportPreviewRows([]);
      fetchVideos(1, pagination.pageSize, search, fCourse, fBook, fChapter);
    } catch (err) {
      console.error("Import failed", err);
      toast.error(err?.response?.data?.message || "Import failed");
    }
  };

  // Derive filtered options for selects
  const booksForCourse = books.filter((b) => !fCourse || String(b.course_id) === String(fCourse));
  const chaptersForBook = chapters.filter((ch) => !fBook || String(ch.book_id) === String(fBook));

  // Effect for thumbnail preview on video_link change
  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      if (!form.video_link) {
        setThumbnailPreview(DEFAULT_IMAGE);
        return;
      }
      const derived = await deriveThumbnail(form.video_link);
      if (active) setThumbnailPreview(derived || DEFAULT_IMAGE);
    }, 300);
    return () => { active = false; clearTimeout(id); };
  }, [form.video_link]);

  const staticColumns = [
    { Header: "Title", accessor: "tittle" },
    { Header: "Course", accessor: "course_name" },
    { Header: "Book", accessor: "book_name" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Videos</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage video gallery – thumbnails derived automatically
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OutlineBtn size="sm" onClick={() => setImportOpen(true)}>
                Import CSV
              </OutlineBtn>
              <ExportCSV
                columns={staticColumns}
                rows={rows}
                filename={`videos_export_${new Date().toISOString().slice(0, 10)}.csv`}
              />
              <PrimaryBtn size="sm" onClick={() => openEditor(null)} leftIcon={ERPIcons.Plus}>
                New Video
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <FormField label="Search">
                <TextInput
                  placeholder="Search title or description..."
                  value={search}
                  onChange={setSearch}
                />
              </FormField>
            </div>
            <FormField label="Course">
              <Select
                value={fCourse}
                onChange={(v) => {
                  setFCourse(v);
                  setFBook("");
                  setFChapter("");
                }}
                options={[
                  { value: "", label: "All Courses" },
                  ...courses.map((c) => ({ value: c.course_id, label: c.course_name })),
                ]}
              />
            </FormField>
            <FormField label="Book">
              <Select
                value={fBook}
                onChange={(v) => {
                  setFBook(v);
                  setFChapter("");
                }}
                options={[
                  { value: "", label: "All Books" },
                  ...booksForCourse.map((b) => ({ value: b.book_id, label: b.book_name })),
                ]}
              />
            </FormField>
            <FormField label="Chapter">
              <Select
                value={fChapter}
                onChange={setFChapter}
                options={[
                  { value: "", label: "All Chapters" },
                  ...chaptersForBook.map((ch) => ({ value: ch.chapter_id, label: ch.chapter_name })),
                ]}
              />
            </FormField>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">Rows:</label>
              <select
                value={pagination.pageSize}
                onChange={(e) => setPagination((p) => ({ ...p, pageSize: Number(e.target.value), page: 1 }))}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700"
              >
                {[12, 24, 48].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <SecondaryBtn size="sm" onClick={() => fetchVideos(1, pagination.pageSize)}>
              Reload
            </SecondaryBtn>
          </div>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <LoadingCard key={i} variant="detailed" lines={3} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No videos found
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {rows.map((video) => (
                <motion.div
                  key={video.video_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-full h-40 bg-gray-100 dark:bg-gray-700 cursor-pointer overflow-hidden"
                    onClick={() => openPlayer(video)}
                  >
                    {video._deriving || !video.thumbnail ? (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-600 animate-pulse" />
                    ) : (
                      <img
                        src={video.thumbnail}
                        alt={video.tittle}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.src = DEFAULT_IMAGE)}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-white/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {video.tittle || video.title || video.displayTitle}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-auto">
                      <span>
                        {[video.course_name, video.book_name, video.chapter_name]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </span>
                      <span>{new Date(video.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-2">
                      <IconBtn
                        icon={ERPIcons.Edit}
                        size="xs"
                        onClick={() => openEditor(video)}
                        title="Edit"
                      />
                      <IconBtn
                        icon={ERPIcons.Delete}
                        size="xs"
                        className="hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        onClick={() => handleDelete(video)}
                        title="Delete"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </div>
              <Pagination
                currentPage={pagination.page}
                totalPages={Math.ceil(pagination.total / pagination.pageSize)}
                onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
                showNumbers
              />
            </div>
          </>
        )}
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {editorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setEditorOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
                <img src={LOGO} alt="Logo" className="h-10 sm:h-12 w-auto rounded" />
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                    {editing ? "Edit Video" : "Create Video"}
                  </h2>
                </div>
                <IconBtn icon={ERPIcons.Close} onClick={() => setEditorOpen(false)} />
              </div>

              {/* Form */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <FormField label="Title *" required>
                  <TextInput
                    value={form.tittle}
                    onChange={(v) => setForm((f) => ({ ...f, tittle: v, title: v }))}
                    placeholder="Video title"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Course">
                    <Select
                      value={form.course_id}
                      onChange={(v) => setForm((f) => ({ ...f, course_id: v, book_id: "", chapter_id: "" }))}
                      options={[
                        { value: "", label: "None" },
                        ...courses.map((c) => ({ value: c.course_id, label: c.course_name })),
                      ]}
                      disabled={lookupsFailed}
                    />
                  </FormField>
                  <FormField label="Book">
                    <Select
                      value={form.book_id}
                      onChange={(v) => setForm((f) => ({ ...f, book_id: v, chapter_id: "" }))}
                      options={[
                        { value: "", label: "None" },
                        ...books
                          .filter((b) => !form.course_id || String(b.course_id) === String(form.course_id))
                          .map((b) => ({ value: b.book_id, label: b.book_name })),
                      ]}
                      disabled={lookupsFailed}
                    />
                  </FormField>
                  <FormField label="Chapter">
                    <Select
                      value={form.chapter_id}
                      onChange={(v) => setForm((f) => ({ ...f, chapter_id: v }))}
                      options={[
                        { value: "", label: "None" },
                        ...chapters
                          .filter((ch) => !form.book_id || String(ch.book_id) === String(form.book_id))
                          .map((ch) => ({ value: ch.chapter_id, label: ch.chapter_name })),
                      ]}
                      disabled={lookupsFailed}
                    />
                  </FormField>
                  <FormField label="Video Link">
                    <TextInput
                      value={form.video_link}
                      onChange={(v) => setForm((f) => ({ ...f, video_link: v }))}
                      placeholder="https://..."
                    />
                  </FormField>
                </div>

                <FormField label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
                    rows={4}
                  />
                </FormField>

                <div className="flex items-center gap-4">
                  <OutlineBtn
                    type="button"
                    onClick={() => {
                      const tempTitle = form.tittle || form.title || "Preview";
                      setPlayerTitle(tempTitle);
                      setPlayerHtml(makePlayerHtml(form.video_link || "", tempTitle));
                      setPlayerOpen(true);
                    }}
                  >
                    Preview
                  </OutlineBtn>
                  <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                    Thumbnail: {thumbnailPreview !== DEFAULT_IMAGE ? "Derived" : "Will be derived"}
                  </div>
                  <OutlineBtn
                    type="button"
                    onClick={async () => {
                      setThumbnailPreview(DEFAULT_IMAGE);
                      const derived = await deriveThumbnail(form.video_link || "");
                      setThumbnailPreview(derived || DEFAULT_IMAGE);
                    }}
                  >
                    Regenerate
                  </OutlineBtn>
                </div>

                {thumbnailPreview !== DEFAULT_IMAGE && (
                  <div className="mt-4">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail"
                      className="w-full max-h-48 object-cover rounded-lg"
                      onError={(e) => (e.currentTarget.src = DEFAULT_IMAGE)}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <OutlineBtn onClick={() => setEditorOpen(false)}>Cancel</OutlineBtn>
                  <PrimaryBtn type="submit">Save Video</PrimaryBtn>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Player Modal */}
      <AnimatePresence>
        {playerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{playerTitle}</h3>
                <IconBtn icon={ERPIcons.Close} onClick={() => setPlayerOpen(false)} />
              </div>
              <div className="p-2" dangerouslySetInnerHTML={{ __html: playerHtml }} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import CSV Modal */}
      <AnimatePresence>
        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setImportOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Import Videos from CSV</h2>
                <div className="space-y-4">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => onImportFileSelected(e.target.files)}
                      className="text-sm"
                    />
                  </div>
                  <FormField label="Or paste CSV content">
                    <textarea
                      value={importText}
                      onChange={(e) => {
                        setImportText(e.target.value);
                        setImportPreviewRows(parseCSVQuick(e.target.value));
                      }}
                      rows={8}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 p-2"
                    />
                  </FormField>

                  {importPreviewRows.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <h4 className="font-medium text-sm mb-2">Preview (first rows)</h4>
                      <div className="text-xs space-y-1">
                        {importPreviewRows.map((row, i) => (
                          <div key={i} className="truncate text-gray-600 dark:text-gray-300">
                            {Object.values(row).join(" | ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <OutlineBtn onClick={() => setImportOpen(false)}>Cancel</OutlineBtn>
                    <PrimaryBtn onClick={submitImport}>Import</PrimaryBtn>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}