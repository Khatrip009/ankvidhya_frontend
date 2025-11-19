// src/pages/videos.jsx
import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import ERPIcons from '../components/icons.jsx';
import { FormField, TextInput, Select } from '../components/input.jsx';
import { ExportCSV } from '../components/table.jsx';

const headerLogo = '/images/Ank_Logo.png';
const placeholder = '/images/placeholder.png';

// Toggle this to true to automatically persist derived thumbnails to backend via PUT /api/videos/:id
const AUTO_SAVE_DERIVED_THUMBS = true;

const SafeIcon = ({ name, size = 16, style = {}, ...props }) => {
  const Comp = ERPIcons && ERPIcons[name];
  if (Comp) return <Comp width={size} height={size} style={style} {...props} />;
  // fallback play-ish square
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...props}>
      <rect x="0" y="0" width="24" height="24" rx="3" fill="rgba(11,110,255,0.06)" />
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
};

/* ---------- Helpers ---------- */

function isDirectVideo(url = '') {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}
function isYouTube(url = '') {
  return /youtu\.be\/|youtube\.com\/(watch|embed)/i.test(url);
}
function isVimeo(url = '') {
  return /vimeo\.com\/(video\/)?\d+/i.test(url);
}
function isGoogleDrive(url = '') {
  return /drive\.google\.com/i.test(url);
}
function getYouTubeId(url = '') {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = url.match(/embed\/(.+?)(\?|$)/);
    return m ? m[1] : null;
  } catch { return null; }
}
function youTubeThumbnail(url = '') {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
async function vimeoThumbnail(url = '') {
  try {
    const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembed);
    if (!res.ok) throw new Error('vimeo oembed failed');
    const json = await res.json();
    return json?.thumbnail_url || null;
  } catch (err) {
    console.warn('vimeo thumbnail error', err);
    return null;
  }
}
function driveThumbnail(url = '') {
  const m = url.match(/\/file\/d\/([^/]+)\//);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}`; // permission-dependent
  return null;
}

async function generatePosterFromVideo(url = '') {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      let resolved = false;
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;

      const cleanup = () => {
        try { video.pause(); } catch (e) {}
        try { video.removeAttribute('src'); } catch (e) {}
        try { video.load && video.load(); } catch (e) {}
      };

      const onError = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(null);
      };

      video.addEventListener('error', onError);

      video.addEventListener('loadedmetadata', () => {
        const seekTo = Math.min(1, Math.floor(video.duration / 2) || 0);
        const onSeeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(dataUrl);
            }
          } catch (err) {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(null);
            }
          }
        };

        const t = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          if (!resolved) { resolved = true; cleanup(); resolve(null); }
        }, 4000);

        video.addEventListener('seeked', function s() { clearTimeout(t); onSeeked(); video.removeEventListener('seeked', s); });
        try { video.currentTime = seekTo; } catch (e) { onSeeked(); }
      });

      setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(null); } }, 7000);
    } catch (err) { resolve(null); }
  });
}

async function deriveThumbnail(link = '') {
  if (!link) return null;
  try {
    if (isYouTube(link)) return youTubeThumbnail(link);
    if (isVimeo(link)) return await vimeoThumbnail(link);
    if (isGoogleDrive(link)) return driveThumbnail(link);
    if (isDirectVideo(link)) return await generatePosterFromVideo(link);
    return null;
  } catch (err) { console.warn('deriveThumbnail', err); return null; }
}

/* ---------- Component ---------- */
export default function VideosPage() {
  const [courses, setCourses] = useState([]);
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 24, total: 0 });

  const [q, setQ] = useState('');
  const qRef = useRef('');
  const debounceTimer = useRef(null);

  const [fCourse, setFCourse] = useState('');
  const [fBook, setFBook] = useState('');
  const [fChapter, setFChapter] = useState('');

  // editor/player state
  const [editorOpen, setEditorOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerHtml, setPlayerHtml] = useState('');
  const [playerTitle, setPlayerTitle] = useState('Video');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    video_id: null, tittle: '', title: '', video_link: '', description: '', course_id: '', book_id: '', chapter_id: ''
  });

  // derived thumbnail preview (no upload)
  const [thumbnailPreview, setThumbnailPreview] = useState(placeholder);
  const mounted = useRef(false);
  const lookupsFailedRef = useRef(false);
  const [lookupsFailedFlag, setLookupsFailedFlag] = useState(false);

  // CSV import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const fileInputRef = useRef(null);

  /* ---------- Load lookups ---------- */
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const loader = async () => {
          const [cRes, bRes, chRes] = await Promise.all([
            api.get('/api/courses', { query: { pageSize: 1000 } }),
            api.get('/api/books', { query: { pageSize: 1000 } }),
            api.get('/api/chapters', { query: { pageSize: 1000 } }),
          ]);
          return [cRes?.data || [], bRes?.data || [], chRes?.data || []];
        };
        const [cd, bd, chd] = await loader();
        if (!mounted.current) return;
        setCourses(cd);
        setBooks(bd);
        setChapters(chd);
        lookupsFailedRef.current = false;
        setLookupsFailedFlag(false);
      } catch (err) {
        console.error('lookups', err);
        lookupsFailedRef.current = true;
        setLookupsFailedFlag(true);
        window.ui?.toast?.('Failed to load lookup lists — backend may be busy', 'warning');
      }
    })();
    return () => { mounted.current = false; };
  }, []);

  /* ---------- Fetch rows (debounced search) ---------- */
  useEffect(() => {
    qRef.current = q;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPagination(p => ({ ...p, page: 1 }));
      fetchRows({ page: 1, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter });
    }, 350);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    fetchRows({ page: pagination.page, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, fCourse, fBook, fChapter]);

  async function fetchRows({ page = 1, pageSize = 24, search = '', courseId = '', bookId = '', chapterId = '' } = {}) {
    setLoading(true);
    try {
      const qobj = { page, pageSize };
      if (search) qobj.search = search;
      if (courseId) qobj.course_id = courseId;
      if (bookId) qobj.book_id = bookId;
      if (chapterId) qobj.chapter_id = chapterId;

      const res = await api.get('/api/videos', { query: qobj });
      const data = res?.data || [];
      const pg = res?.pagination || { page, pageSize, total: data.length };

      // normalize each row to have `displayTitle` and prefer tittle then title
      // Also provide an immediate thumbnail fallback for YouTube links so the grid shows it
      const mapped = data.map(r => {
        const t = r.tittle || r.title || '';
        const immediateThumb = r.thumbnail || (r.video_link ? youTubeThumbnail(r.video_link) : null);
        return {
          ...r,
          displayTitle: t,
          tittle: r.tittle || r.title || '',
          title: r.title || r.tittle || '',
          thumbnail: immediateThumb, // may be null
          _deriving: false
        };
      });

      if (!mounted.current) return;
      setRows(mapped);
      setPagination({ page: pg.page, pageSize: pg.pageSize, total: pg.total });

      // Async pass: for rows that still have no thumbnail, try to derive (Vimeo, direct video).
      (async () => {
        const snapshot = mapped.slice();
        for (const r of snapshot) {
          if (r.thumbnail || !r.video_link) continue;
          setRows(prev => prev.map(p => p.video_id === r.video_id ? { ...p, _deriving: true } : p));
          try {
            const derived = await deriveThumbnail(r.video_link || '');
            if (derived) {
              setRows(prev => prev.map(p => p.video_id === r.video_id ? { ...p, thumbnail: derived, _deriving: false } : p));
              if (AUTO_SAVE_DERIVED_THUMBS) {
                try {
                  await api.put(`/api/videos/${r.video_id}`, { thumbnail: derived, tittle: r.tittle || r.title, title: r.tittle || r.title });
                } catch (err) {
                  console.warn('auto-save thumbnail failed', err);
                }
              }
            } else {
              setRows(prev => prev.map(p => p.video_id === r.video_id ? { ...p, _deriving: false } : p));
            }
          } catch (err) {
            console.warn('derive thumbnail for row failed', err);
            setRows(prev => prev.map(p => p.video_id === r.video_id ? { ...p, _deriving: false } : p));
          }
        }
      })();
    } catch (err) {
      console.error('fetch videos', err);
      if (mounted.current) {
        window.ui?.toast?.('Failed to load videos — backend may be busy', 'danger');
        setRows([]);
        setPagination(p => ({ ...p, total: 0 }));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  /* ---------- Editor open/populate ---------- */
  function openEditor(row = null) {
    setEditing(row);
    if (row) {
      setForm({
        video_id: row.video_id || null,
        tittle: row.tittle || row.title || '',
        title: row.title || row.tittle || '',
        video_link: row.video_link || '',
        description: row.description || '',
        course_id: row.course_id || '',
        book_id: row.book_id || '',
        chapter_id: row.chapter_id || ''
      });
      (async () => {
        if (row.thumbnail) setThumbnailPreview(row.thumbnail);
        else {
          setThumbnailPreview(placeholder);
          const derived = await deriveThumbnail(row.video_link || '');
          setThumbnailPreview(derived || placeholder);
        }
      })();
    } else {
      setForm({ video_id: null, tittle: '', title: '', video_link: '', description: '', course_id: '', book_id: '', chapter_id: '' });
      setThumbnailPreview(placeholder);
    }
    setEditorOpen(true);
  }

  function openPlayer(row) {
    const link = row.video_link || '';
    setPlayerTitle(row.tittle || row.title || 'Video');
    setPlayerHtml(makePlayerHtml(link, row.tittle || row.title || 'Video'));
    setPlayerOpen(true);
  }

  /* ---------- Delete ---------- */
  async function deleteRow(row) {
    if (!confirm('Delete this video?')) return;
    try {
      await api.del(`/api/videos/${row.video_id}`);
      window.ui?.toast?.('Video deleted', 'success');
      fetchRows({ page: pagination.page, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter });
    } catch (err) {
      console.error('delete', err);
      window.ui?.toast?.('Delete failed', 'danger');
    }
  }

  /* ---------- Save (create/update) ---------- */
  async function handleSave(e) {
    e && e.preventDefault && e.preventDefault();
    const titleVal = (form.tittle || form.title || '').trim();
    if (!titleVal) { window.ui?.toast?.('Title required', 'danger'); return; }

    try {
      let thumbnailUrl = null;
      try { thumbnailUrl = await deriveThumbnail(form.video_link || ''); } catch (e) { thumbnailUrl = null; }

      const payload = {
        tittle: titleVal,
        title: titleVal,
        video_link: (form.video_link || '').trim() || null,
        description: (form.description || '').trim() || null,
        course_id: form.course_id ? Number(form.course_id) : null,
        book_id: form.book_id ? Number(form.book_id) : null,
        chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
        thumbnail: thumbnailUrl || null
      };

      if (editing && editing.video_id) {
        await api.put(`/api/videos/${editing.video_id}`, payload);
        window.ui?.toast?.('Video updated', 'success');
      } else {
        await api.post('/api/videos', payload);
        window.ui?.toast?.('Video created', 'success');
      }

      setEditorOpen(false);
      setEditing(null);
      fetchRows({ page: 1, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter });
    } catch (err) {
      console.error('save video', err);
      const serverMsg = err?.response?.data?.message || err?.message || 'Save failed';
      window.ui?.toast?.(serverMsg, 'danger');
    }
  }

  /* ---------- Small UI helpers ---------- */
  function safeImgOnError(e) {
    if (e?.currentTarget?.dataset?.fallback) return;
    const fallback = placeholder;
    if (e?.currentTarget) {
      e.currentTarget.dataset.fallback = '1';
      e.currentTarget.src = fallback;
    }
  }

  function fmtDate(s) { return s ? new Date(s).toLocaleString() : '-'; }

  /* ---------- Derived option lists ---------- */
  const booksForCourse = (books || []).filter(b => !fCourse || String(b.course_id) === String(fCourse));
  const chaptersForBook = (chapters || []).filter(ch => !fBook || String(ch.book_id) === String(fBook));

  /* ---------- Effect: recompute thumbnail preview when link changes ---------- */
  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      if (!form.video_link) { setThumbnailPreview(placeholder); return; }
      setThumbnailPreview(placeholder);
      const derived = await deriveThumbnail(form.video_link || '');
      if (!active) return;
      setThumbnailPreview(derived || placeholder);
    }, 300);
    return () => { active = false; clearTimeout(id); };
  }, [form.video_link]);

  /* ---------- CSV import helpers ---------- */
  function parseCSVQuick(text) {
    // very lightweight parse used only for preview (not authoritative)
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    // parse headers
    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
    const preview = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const row = parseCSVRow(lines[i]);
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j] !== undefined ? row[j] : '';
      preview.push(obj);
    }
    return preview;
  }
  function parseCSVRow(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i=0;i<line.length;i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === ',') { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  async function onImportFileSelected(files) {
    if (!files || !files.length) return;
    const f = files[0];
    try {
      const txt = await f.text();
      setImportText(txt);
      setImportPreviewRows(parseCSVQuick(txt));
    } catch (err) {
      console.error('read csv', err);
      window.ui?.toast?.('Failed to read file', 'danger');
    }
  }

  async function submitImport() {
    const text = (importText || '').trim();
    if (!text) { window.ui?.toast?.('CSV content required', 'danger'); return; }
    try {
      // send to server endpoint that expects body.csv
      await api.post('/api/videos/import', { csv: text });
      window.ui?.toast?.('CSV imported successfully', 'success');
      setImportOpen(false);
      setImportText('');
      setImportPreviewRows([]);
      fetchRows({ page: 1, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter });
    } catch (err) {
      console.error('import csv', err);
      const serverMsg = err?.response?.data?.message || err?.message || 'Import failed';
      window.ui?.toast?.(serverMsg, 'danger');
    }
  }

  /* ---------- Player template helpers ---------- */
  function youTubeEmbed(url = '') {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      return url.replace('/watch?v=', '/embed/');
    } catch { return url; }
  }
  function vimeoEmbed(url = '') {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  function driveEmbed(url = '') {
    const m = url.match(/\/file\/d\/([^/]+)\//);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    return url;
  }
  function makePlayerHtml(link = '', title = '') {
    if (!link) return `<div class="p-4 text-muted">No video link</div>`;
    if (isDirectVideo(link)) {
      return `
      <video controls playsinline preload="metadata" style="width:100%;max-height:70vh;border-radius:8px;background:#000">
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
      <iframe src="${src}" title="${(title || 'Video').replace(/"/g,'')}" style="position:absolute;left:0;top:0;width:100%;height:100%;border:0;border-radius:8px;" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen></iframe>
    </div>`;
  }

  /* ---------- Render ---------- */
  return (
    <main className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto", fontSize: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');

        :root{
          --bg:#f5f8ff;
          --card:#ffffff;
          --muted:#56607a;
          --accent:#0ea5a3;
          --accent-2:#0B6EFF; /* corporate blue */
          --glass: rgba(255,255,255,0.6);
          --radius:14px;
        }

        body, input, select, textarea, button { font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }

        .panel {
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,252,255,0.98));
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 14px 40px rgba(11,34,80,0.06);
          border: 1px solid rgba(11,34,80,0.04);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .panel:hover { transform: translateY(-3px); box-shadow: 0 22px 56px rgba(11,34,80,0.08); }

        .controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:18px; }

        .card {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(11,34,80,0.06);
          background: var(--card);
          display:flex;
          flex-direction:column;
          transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease;
        }
        .card:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 26px 60px rgba(11,34,80,0.08); }

        .thumb-wrap { position: relative; display:block; }
        .thumb {
          width:100%;
          height:170px;
          object-fit:cover;
          background: linear-gradient(180deg,#eef2ff,#f8fafc);
          display:block;
          transition: transform .18s ease;
        }
        .thumb-wrap:hover .thumb { transform: scale(1.02); }

        .thumb-play {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0.98);
          width: 64px;
          height: 64px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.9));
          box-shadow: 0 12px 28px rgba(11,110,255,0.10);
          opacity: 0;
          transition: opacity .18s ease, transform .18s ease;
          border: 2px solid rgba(11,110,255,0.12);
        }
        .thumb-wrap:hover .thumb-play { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        .thumb-play svg { width:22px; height:22px; fill: var(--accent-2); }

        .skel {
          width: 100%;
          height: 170px;
          border-radius: 6px;
          background: linear-gradient(90deg, #f3f4f6 25%, #eef2ff 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: skelShimmer 1.4s linear infinite;
        }
        @keyframes skelShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }

        .card-body { padding:14px; display:flex; flex-direction:column; gap:10px; }
        .muted { color:var(--muted); font-size:14px; }
        h2 { font-size:20px; margin:0; color:#0f172a; letter-spacing:0.2px; }

        .form-control, .form-select, input[type=text], textarea { font-size:15px; padding:10px 12px; border-radius:10px; }
        .btn { padding:10px 12px; border-radius:10px; font-weight:600; font-size:15px; transition: transform .12s ease, box-shadow .12s ease; cursor:pointer; }
        .btn:active { transform: translateY(1px); }
        .btn-primary { background: var(--accent-2); color: white; border:none; box-shadow: 0 10px 28px rgba(11,110,255,0.12); }
        .btn-primary:hover { filter: saturate(1.05); box-shadow: 0 14px 36px rgba(11,110,255,0.14); }
        .btn-outline { background: transparent; border:1px solid rgba(11,34,80,0.06); }

        .btn-sm { padding:8px 10px; border-radius:8px; }
        .editor-header { display:flex; align-items:center; gap:12px; padding:18px; border-bottom:1px solid rgba(11,34,80,0.04); }
        .editor-title { flex:1; text-align:center; font-weight:700; font-size:18px; }

        .modal-backdrop{ position:fixed; inset:0; z-index:9999; background:linear-gradient(0deg, rgba(2,6,23,0.55), rgba(2,6,23,0.45)); display:flex; align-items:center; justify-content:center; }
        .modal-card { width:980px; max-width:96%; border-radius:12px; overflow:hidden; background:linear-gradient(180deg,#fff,#fbfdff); box-shadow: 0 28px 80px rgba(11,34,80,0.18); transform: translateY(8px); animation: modalIn .22s cubic-bezier(.2,.9,.2,1) both; }
        @keyframes modalIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 900px) {
          .grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
          .thumb { height: 150px; }
          .card-body { padding:12px; }
        }
      `}</style>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img src={headerLogo} alt="logo" style={{ height: 36 }} onError={safeImgOnError} />
          <div style={{ fontWeight: 700, fontSize: 20 }}>Videos — Gallery</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={() => setImportOpen(true)}><ERPIcons.UploadCloud style={{ width: 16, height: 16, marginRight: 8 }} />Import CSV</button>
          <ExportCSV columns={[{ Header: 'Title', accessor: 'tittle' }, { Header: 'Course', accessor: 'course_name' }, { Header: 'Book', accessor: 'book_name' }]} rows={rows} filename={`videos_${new Date().toISOString().slice(0,10)}.csv`} />
          <button className="btn btn-primary" onClick={() => openEditor(null)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ERPIcons.Plus style={{ width: 16, height: 16 }} /> New Video
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>Click a card to play inline. Create and manage videos with thumbnails and metadata.</div>
            {lookupsFailedFlag && <div style={{ marginTop: 8, color: '#b45309' }} className="small">Lookup data failed to load — selectors may be empty.</div>}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 220 }}>
              <Select value={fCourse} onChange={(v) => { setFCourse(v); setFBook(''); setFChapter(''); setPagination(p => ({ ...p, page: 1 })); }} options={[{ value: '', label: '— any course —' }].concat((courses || []).map(c => ({ value: c.course_id, label: c.course_name })))} />
            </div>
            <div style={{ width: 220 }}>
              <Select value={fBook} onChange={(v) => { setFBook(v); setFChapter(''); setPagination(p => ({ ...p, page: 1 })); }} options={[{ value: '', label: '— any book —' }].concat(booksForCourse.map(b => ({ value: b.book_id, label: b.book_name })))} />
            </div>
            <div style={{ width: 220 }}>
              <Select value={fChapter} onChange={(v) => { setFChapter(v); setPagination(p => ({ ...p, page: 1 })); }} options={[{ value: '', label: '— any chapter —' }].concat(chaptersForBook.map(ch => ({ value: ch.chapter_id, label: ch.chapter_name })))} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="controls">
          <div style={{ flex: '1 1 360px' }}>
            <TextInput placeholder="Search title or description..." value={q} onChange={(v) => { setQ(v); }} />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={pagination.pageSize} onChange={(e) => setPagination(p => ({ ...p, pageSize: Number(e.target.value), page: 1 }))} className="form-select">
              {[12, 24, 48].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-outline" onClick={() => fetchRows({ page: 1, pageSize: pagination.pageSize, search: qRef.current, courseId: fCourse, bookId: fBook, chapterId: fChapter })}>Reload</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading ? <div style={{ padding: 28, textAlign: 'center' }}>Loading…</div> : (
          <div className="grid">
            {(!rows || rows.length === 0) && <div className="muted">No videos found</div>}
            {rows.map(v => (
              <article key={v.video_id} className="card" aria-labelledby={`vtitle-${v.video_id}`}>
                <div style={{ cursor: 'pointer' }} onClick={() => openPlayer(v)}>
                  <div className="thumb-wrap" role="button" aria-label={`Play ${v.tittle || v.title || v.displayTitle}`}>
                    {(v._deriving || !v.thumbnail) ? (
                      <div className="skel" />
                    ) : (
                      <img className="thumb" src={v.thumbnail || placeholder} alt={v.tittle || v.title || 'thumb'} onError={safeImgOnError} />
                    )}
                    <div className="thumb-play" aria-hidden>
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div id={`vtitle-${v.video_id}`} style={{ fontWeight: 700, color: '#0f172a', fontSize: 16 }}>{v.tittle || v.title || v.displayTitle}</div>
                      <div className="muted" style={{ marginTop: 8 }}>{v.description ? String(v.description).slice(0,140) + (v.description.length>140? '…':'' ) : 'No description'}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn-sm btn" onClick={() => openEditor(v)} title="Edit"><ERPIcons.Edit style={{ width: 14, height: 14 }} /></button>
                      <button className="btn-sm btn" onClick={() => deleteRow(v)} title="Delete"><ERPIcons.Delete style={{ width: 14, height: 14 }} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                    <div className="muted">{v.course_name || '-'} • {v.book_name || '-'} • {v.chapter_name || '-'}</div>
                    <div className="muted">{fmtDate(v.created_at)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="muted">{rows.length ? `${(pagination.page-1)*pagination.pageSize+1}–${Math.min(pagination.page*pagination.pageSize, pagination.total)} of ${pagination.total}` : ''}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={pagination.page<=1} onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}>Prev</button>
            <button className="btn btn-primary" disabled={(pagination.page*pagination.pageSize) >= pagination.total} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next</button>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); }} onMouseDown={(e) => { e.stopPropagation(); }}>
          <form
                onSubmit={handleSave}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="modal-card"
                >

            <div className="editor-header">
              <img src={headerLogo} alt="Ank" style={{ height: 46 }} onError={safeImgOnError} />
              <div className="editor-title">{editing ? 'Edit Video' : 'Create Video'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>Close</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, padding: 18 }}>
              <div>
                <FormField label="Title" required>
                  <TextInput value={form.tittle} onChange={(v) => setForm(f => ({ ...f, tittle: v, title: v }))} />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Course">
                    <Select value={form.course_id} onChange={(v) => setForm(f => ({ ...f, course_id: v, book_id: '', chapter_id: '' }))} options={[{ value: '', label: '— none —' }].concat((courses || []).map(c => ({ value: c.course_id, label: c.course_name })))} disabled={lookupsFailedFlag} />
                  </FormField>
                  <FormField label="Book">
                    <Select value={form.book_id} onChange={(v) => setForm(f => ({ ...f, book_id: v, chapter_id: '' }))} options={[{ value: '', label: '— none —' }].concat(booksForCourse.map(b => ({ value: b.book_id, label: b.book_name })))} disabled={lookupsFailedFlag} />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Chapter">
                    <Select value={form.chapter_id} onChange={(v) => setForm(f => ({ ...f, chapter_id: v }))} options={[{ value: '', label: '— none —' }].concat(chaptersForBook.map(ch => ({ value: ch.chapter_id, label: ch.chapter_name })))} disabled={lookupsFailedFlag} />
                  </FormField>

                  <FormField label="Video link (YouTube/Vimeo/Drive/MP4)">
                    <TextInput value={form.video_link} onChange={(v) => setForm(f => ({ ...f, video_link: v }))} placeholder="https://..." />
                  </FormField>
                </div>

                <FormField label="Description">
                  <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="form-control" rows={5} />
                </FormField>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn" onClick={() => {
                    const tempTitle = form.tittle || form.title || 'Preview';
                    setPlayerTitle(tempTitle);
                    setPlayerHtml(makePlayerHtml(form.video_link || '', tempTitle));
                    setPlayerOpen(true);
                  }}><ERPIcons.Play style={{ width: 16, height: 16, marginRight: 6 }} />Preview</button>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="muted">Thumbnail:</div>
                    <div className="muted" style={{ fontSize: 13 }}>{thumbnailPreview && thumbnailPreview !== placeholder ? 'derived or backend' : 'will be derived from URL'}</div>
                    <button type="button" className="btn btn-outline" onClick={async () => {
                      setThumbnailPreview(placeholder);
                      const d = await deriveThumbnail(form.video_link || '');
                      setThumbnailPreview(d || placeholder);
                    }}>Regenerate</button>
                  </div>
                </div>
              </div>

              <aside>
                <div style={{ marginTop: 0 }}>
                  <div style={{ border: '1px solid rgba(2,6,23,0.04)', borderRadius: 12, padding: 10, background:'linear-gradient(180deg,#fff,#fbfdff)' }}>
                    <img src={thumbnailPreview} alt="thumb" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 10 }} onError={safeImgOnError} />
                    <div className="muted" style={{ marginTop: 10 }}>{thumbnailPreview === placeholder ? 'Thumbnail preview' : 'Derived thumbnail'}</div>
                    {AUTO_SAVE_DERIVED_THUMBS && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Derived thumbnails are auto-saved to backend (best-effort).</div>}
                  </div>
                </div>
              </aside>
            </div>

            <div style={{ padding: 14, borderTop: '1px solid rgba(2,6,23,0.03)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save video</button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Import Modal */}
      {importOpen && (
        <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); }} onMouseDown={(e) => { e.stopPropagation(); }}>
          <div className="modal-card" style={{ padding: 16, maxWidth: 980 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Import Videos from CSV</div>
              <div>
                <button className="btn btn-outline" onClick={() => { setImportOpen(false); setImportText(''); setImportPreviewRows([]); }}>Close</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
              <div>
                <div style={{ marginBottom: 8 }}>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(e) => onImportFileSelected(e.target.files)} />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ marginBottom: 6, color: 'var(--muted)' }}>Or paste CSV text below (headers allowed: title,tittle,description,video_link,course_name,book_name,chapter_name)</div>
                  <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportPreviewRows(parseCSVQuick(e.target.value)); }} rows={10} className="form-control" />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={submitImport}>Import CSV</button>
                  <button className="btn btn-outline" onClick={() => { setImportText(''); setImportPreviewRows([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Clear</button>
                </div>

                <div style={{ marginTop: 12, color: 'var(--muted)' }}>
                  <div style={{ marginBottom: 6 }}>Preview (first up to 5 rows):</div>
                  <div style={{ background: '#fff', border: '1px solid rgba(2,6,23,0.04)', borderRadius: 8, padding: 10 }}>
                    {importPreviewRows.length === 0 ? <div style={{ color: '#9aa4b2' }}>No preview available</div> : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {Object.keys(importPreviewRows[0]).map(h => <th key={h} style={{ textAlign: 'left', padding: 6, fontSize: 13, color: '#374151' }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreviewRows.map((r, i) => (
                              <tr key={i}>
                                {Object.keys(r).map(k => <td key={k} style={{ padding: 6, fontSize: 13, color: '#475569' }}>{String(r[k] ?? '')}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside>
                <div style={{ border: '1px solid rgba(2,6,23,0.04)', borderRadius: 10, padding: 12, background: 'linear-gradient(180deg,#fff,#fbfdff)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>CSV Import Notes</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)' }}>
                    <li>Header names supported: <code>title</code> or <code>tittle</code> (either), <code>description</code>, <code>video_link</code>, <code>course_name</code>, <code>book_name</code>, <code>chapter_name</code>.</li>
                    <li>Rows are resolved against course/book/chapter names when provided — ensure names match existing records.</li>
                    <li>Large CSVs are accepted; server will insert rows in bulk.</li>
                    <li>If import fails, server will return an error message.</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* Player lightbox */}
      {playerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(2,6,23,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setPlayerOpen(false); setPlayerHtml(''); }}>
          <div style={{ width: '90%', maxWidth: 1100, background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid rgba(2,6,23,0.04)' }}>
              <div style={{ fontWeight: 700 }}>{playerTitle}</div>
              <div><button className="btn" onClick={() => { setPlayerOpen(false); setPlayerHtml(''); }}>Close</button></div>
            </div>
            <div style={{ padding: 12 }} dangerouslySetInnerHTML={{ __html: playerHtml }} />
          </div>
        </div>
      )}
    </main>
  );
}
