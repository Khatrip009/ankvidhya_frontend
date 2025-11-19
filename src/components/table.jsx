/*
  tables.jsx
  Comprehensive set of reusable Table components for Shreeja ERP
  - TailwindCSS assumed for styling
  - Framer Motion available for subtle animations
  - No external table libraries required (vanilla React + hooks)
  - Exports many table variants: SimpleTable, DataTable (client & server), EditableTable,
    VirtualizedTable (uses simple windowing), TreeTable, StickyHeaderTable, ExportCSV,
    TableSkeleton, EmptyState, RowActions, BulkActions

  Usage:
    import { DataTable, SimpleTable, EditableTable } from './tables.jsx'

  Notes:
  - Server-side pagination/search should call onFetch({ page, pageSize, sort, filters })
  - For virtualization in production prefer react-virtual or react-window; this simple implementation demonstrates the idea.
  - Keep components composable and small; customize column renderers via `columns` prop.
*/

import React, { useMemo, useState, useEffect, useRef, useCallback, useContext } from 'react';
import { motion } from 'framer-motion';
// Use namespace import for file-saver to avoid build/ESM mismatch issues in some bundlers
import * as FileSaver from 'file-saver';
import PropTypes from 'prop-types';

const cx = (...c) => c.filter(Boolean).join(' ');

/* -------------------- TableTheme (centralized theme + color system) -------------------- */
// TableThemeProvider applies CSS variables scoped to the provider's DOM node
// so you can embed different themed tables on the same page if needed.
import { createContext } from 'react';

export const defaultTableTheme = {
  // primary palette
  '--tbl-primary': '#06b6d4', // cyan-400
  '--tbl-primary-600': '#0ea5a4',
  '--tbl-accent': '#0b8793',
  // neutrals
  '--tbl-bg': '#ffffff',
  '--tbl-surface': '#f8fafc',
  '--tbl-border': '#e6edf0',
  '--tbl-text': '#0f172a',
  '--tbl-muted': '#64748b',
  // semantic
  '--tbl-success': '#10b981',
  '--tbl-danger': '#ef4444',
  '--tbl-warning': '#f59e0b',
};

const TableThemeContext = createContext({ theme: defaultTableTheme });

export const TableThemeProvider = ({ theme = {}, children, applyTo = 'local' }) => {
  const merged = { ...defaultTableTheme, ...(theme || {}) };
  const ref = useRef(null);

  // If applyTo === 'global' we set CSS vars on documentElement
  // otherwise we set them on the provider div (scoped)
  useEffect(() => {
    if (applyTo === 'global' && typeof document !== 'undefined') {
      const root = document.documentElement;
      Object.entries(merged).forEach(([k, v]) => root.style.setProperty(k, v));
      return () => {
        Object.keys(merged).forEach((k) => root.style.removeProperty(k));
      };
    }
    // no cleanup for scoped: the provider will remove when unmounted
  }, [applyTo, merged]);

  return (
    <TableThemeContext.Provider value={{ theme: merged }}>
      {applyTo === 'local' ? (
        <div ref={ref} style={Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v]))}>
          {children}
        </div>
      ) : (
        children
      )}
    </TableThemeContext.Provider>
  );
};
TableThemeProvider.propTypes = { theme: PropTypes.object, children: PropTypes.node, applyTo: PropTypes.oneOf(['local','global']) };

export const useTableTheme = () => {
  const ctx = useContext(TableThemeContext);
  return ctx?.theme ?? defaultTableTheme;
};

// helper to get semantic class names that read from CSS variables
export const tableThemeVars = () => ({
  '--tbl-primary': 'var(--tbl-primary)',
  '--tbl-primary-600': 'var(--tbl-primary-600)',
  '--tbl-accent': 'var(--tbl-accent)',
  '--tbl-bg': 'var(--tbl-bg)',
  '--tbl-surface': 'var(--tbl-surface)',
  '--tbl-border': 'var(--tbl-border)',
  '--tbl-text': 'var(--tbl-text)',
  '--tbl-muted': 'var(--tbl-muted)',
  '--tbl-success': 'var(--tbl-success)',
  '--tbl-danger': 'var(--tbl-danger)',
  '--tbl-warning': 'var(--tbl-warning)',
});

/* -------------------- Utilities -------------------- */
const defaultCompare = (a, b) => {
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

const downloadCSV = (rows, columns, filename = 'export.csv') => {
  const header = columns.map((c) => c.Header ?? (typeof c.accessor === 'string' ? c.accessor : 'column')).join(',');
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = typeof c.accessor === 'function' ? c.accessor(r) : r[c.accessor];
          // escape quotes
          return '"' + String(v ?? '').replace(/"/g, '""') + '"';
        })
        .join(',')
    )
    .join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  // Use FileSaver namespace import to call saveAs — works across bundlers
  try {
    if (FileSaver && typeof FileSaver.saveAs === 'function') {
      FileSaver.saveAs(blob, filename);
    } else if (typeof window !== 'undefined' && typeof window.navigator?.msSaveOrOpenBlob === 'function') {
      // IE fallback
      window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
      // Fallback: create anchor and click
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    // Last resort fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};

/* -------------------- SimpleTable (declarative) -------------------- */
export const SimpleTable = ({ columns = [], data = [], emptyMessage = 'No records' }) => {
  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="min-w-full table-auto">
        <thead className="bg-slate-50 border-b">
          <tr>
            {columns.map((col) => (
              <th key={col.accessor || col.Header} className="text-left px-4 py-3 text-sm font-medium text-slate-700">{col.Header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-6 text-center text-sm text-slate-500">{emptyMessage}</td>
            </tr>
          )}
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.accessor || col.Header} className="px-4 py-3 text-sm align-top">{col.Cell ? col.Cell(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* -------------------- Table skeleton / loading -------------------- */
export const TableSkeleton = ({ rows = 6, cols = 6 }) => (
  <div className="w-full overflow-hidden bg-white rounded-lg shadow-sm p-4">
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-6 bg-slate-200 rounded w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* -------------------- Empty state -------------------- */
export const EmptyState = ({ title = 'No records', subtitle = '', action = null }) => (
  <div className="bg-white rounded-lg shadow-sm p-10 text-center">
    <h3 className="text-lg font-semibold">{title}</h3>
    {subtitle && <p className="text-sm text-slate-500 mt-2">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* -------------------- DataTable (client-side) -------------------- */
export const DataTable = ({
  columns = [],
  data = [],
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  searchable = true,
  exportable = true,
  selectable = false,
  onRowClick,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => setPage(1), [pageSize, search, data.length]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => columns.some((c) => {
      const v = typeof c.accessor === 'function' ? String(c.accessor(r)) : String(r[c.accessor]);
      return v && v.toLowerCase().includes(q);
    }));
  }, [search, data, columns]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const col = columns.find((c) => c.accessor === sortBy || c.accessor === sortBy.accessor);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
      const bv = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
      const cmp = defaultCompare(av, bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortBy, sortDir, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === pageData.length) setSelected(new Set());
    else setSelected(new Set(pageData.map((r, i) => r.id ?? i)));
  };

  // Small animated icons
  const SortIcon = ({ dir }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" className={dir === 'asc' ? 'transform rotate-180' : ''}>
      <path d="M7 14l5-5 5 5H7z" fill="currentColor" />
    </svg>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
      {/* Toolbar */}
      <div className="p-4 flex items-center justify-between gap-4 bg-gradient-to-r from-white/60 to-slate-50">
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <input
                placeholder="Search by any column..."
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 shadow-sm focus:ring-2 focus:ring-sky-100 w-72 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg className="absolute left-3 top-2.5 text-slate-400" width="16" height="16" viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>
            </div>
          )}

          {exportable && (
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md transition"
              onClick={() => downloadCSV(sorted, columns, 'shreeja_export.csv')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M5 12l7-7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">Rows:</div>
          <select className="px-3 py-2 rounded-lg border" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {pageSizeOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg border bg-white/60 shadow-sm hover:bg-white transition" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="px-3 py-2 rounded-lg border bg-white/60 shadow-sm hover:bg-white transition" disabled={page===1} onClick={() => setPage(p => Math.max(1, p-1))}>‹</button>
            <div className="px-3 py-2 rounded-lg border bg-white/80">{page} / {pages}</div>
            <button className="px-3 py-2 rounded-lg border bg-white/60 shadow-sm hover:bg-white transition" disabled={page===pages} onClick={() => setPage(p => Math.min(pages, p+1))}>›</button>
            <button className="px-3 py-2 rounded-lg border bg-white/60 shadow-sm hover:bg-white transition" disabled={page===pages} onClick={() => setPage(pages)}>»</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate" style={{ borderSpacing: 0 }}>
          <thead className="bg-gradient-to-r from-sky-50 to-white">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selected.size === pageData.length && pageData.length>0} onChange={toggleAll} />
                </th>
              )}

              {columns.map((col) => (
                <th key={col.accessor || col.Header} className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                  <button
                    onClick={() => {
                      if (sortBy === col.accessor) setSortDir(dir => dir==='asc'?'desc':'asc'); else { setSortBy(col.accessor); setSortDir('asc'); }
                    }}
                    className="flex items-center gap-2 group"
                  >
                    <span>{col.Header}</span>
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: sortBy === col.accessor ? 1 : 0 }} className="text-sky-500">
                      <SortIcon dir={sortDir} />
                    </motion.span>
                    <span className="opacity-0 group-hover:opacity-100 text-slate-400">↕</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white">
            {pageData.length === 0 && (
              <tr><td colSpan={columns.length + (selectable?1:0)} className="p-8 text-center text-sm text-slate-500">No records</td></tr>
            )}

            {pageData.map((row, i) => {
              const id = row.id ?? i;
              const sel = selected.has(id);
              return (
                <motion.tr key={id} whileHover={{ scale: 1.01 }} className={cx('transition', sel ? 'bg-sky-50' : 'hover:bg-slate-50')} onClick={() => onRowClick && onRowClick(row)}>
                  {selectable && (
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" checked={sel} onChange={(e) => { e.stopPropagation(); toggleSelect(id); }} />
                    </td>
                  )}

                  {columns.map((col) => (
                    <td key={col.accessor || col.Header} className="px-6 py-3 text-sm align-top">{col.Cell ? col.Cell(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])}</td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-white/60 flex items-center justify-between">
        <div className="text-sm text-slate-600">Showing {(page-1)*pageSize + 1} to {Math.min(page*pageSize, sorted.length)} of {sorted.length} entries</div>
        <div className="flex items-center gap-2">
          <ExportCSV columns={columns} rows={sorted} filename={`shreeja_export_page${page}.csv`} />
        </div>
      </div>
    </div>
  );
};

/* -------------------- Server-side DataTable (calls onFetch) -------------------- */
export const ServerDataTable = ({ columns = [], onFetch, initialPageSize = 10, selectable = false }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await onFetch({ page, pageSize, sortBy, sortDir });
      setData(resp.data || []);
      setTotal(resp.total ?? resp.data.length); 
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, onFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {loading && <div className="p-3 border-b text-sm text-slate-500">Loading...</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              {selectable && <th className="px-4 py-3"><input type="checkbox" /></th>}
              {columns.map((col) => (
                <th key={col.accessor || col.Header} className="px-4 py-3 text-left text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { if (sortBy === col.accessor) setSortDir(dir => dir==='asc'?'desc':'asc'); else { setSortBy(col.accessor); setSortDir('asc'); } }} className="flex items-center gap-2">
                      {col.Header}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-slate-50 cursor-pointer">
                {selectable && <td className="px-4 py-3"><input type="checkbox" /></td>}
                {columns.map((col) => (
                  <td key={col.accessor || col.Header} className="px-4 py-3 text-sm align-top">{col.Cell ? col.Cell(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])}</td>
                ))}
              </tr>
            ))}
            {data.length === 0 && !loading && (<tr><td colSpan={columns.length + (selectable?1:0)} className="p-6 text-center">No records</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 p-3 border-t">
        <div className="text-sm text-slate-600">{(page-1)*pageSize + 1} - {Math.min(page*pageSize, total)} of {total}</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded-md border" disabled={page===1} onClick={() => setPage(1)}>«</button>
          <button className="px-2 py-1 rounded-md border" disabled={page===1} onClick={() => setPage(p => Math.max(1, p-1))}>‹</button>
          <span className="px-2 py-1">{page} / {pages}</span>
          <button className="px-2 py-1 rounded-md border" disabled={page===pages} onClick={() => setPage(p => Math.min(pages, p+1))}>›</button>
          <button className="px-2 py-1 rounded-md border" disabled={page===pages} onClick={() => setPage(pages)}>»</button>
        </div>
      </div>
    </div>
  );
};

/* -------------------- Editable Table (inline editing) -------------------- */
export const EditableTable = ({ columns = [], data = [], onSaveRow }) => {
  const [rows, setRows] = useState(data);

  useEffect(() => setRows(data), [data]);

  const updateCell = (rowIndex, accessor, value) => {
    setRows((r) => {
      const nr = [...r];
      const row = { ...nr[rowIndex] };
      if (typeof accessor === 'function') accessor(row, value); else row[accessor] = value;
      nr[rowIndex] = row;
      return nr;
    });
  };

  const saveRow = (i) => { onSaveRow && onSaveRow(rows[i], i); };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr>{columns.map(c => <th key={c.accessor || c.Header} className="px-4 py-3 text-left text-sm font-medium">{c.Header}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.accessor || col.Header} className="px-4 py-3 text-sm align-top">
                  {col.editable ? (
                    <input value={typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor] ?? ''} onChange={(e) => updateCell(i, col.accessor, e.target.value)} className="px-2 py-1 rounded-md border w-full" />
                  ) : (col.Cell ? col.Cell(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]))}
                </td>
              ))}
              <td className="px-4 py-3"><button className="px-3 py-1 rounded-md bg-cyan-600 text-white" onClick={() => saveRow(i)}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* -------------------- Virtualized Table (simple windowing) -------------------- */
export const VirtualizedTable = ({ columns = [], data = [], rowHeight = 52, height = 400 }) => {
  const containerRef = useRef();
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = data.length * rowHeight;
  const visibleCount = Math.ceil(height / rowHeight) + 4;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endIdx = Math.min(data.length, startIdx + visibleCount);
  const visible = data.slice(startIdx, endIdx);

  return (
    <div style={{ height }} ref={containerRef} onScroll={(e) => setScrollTop(e.target.scrollTop)} className="overflow-auto bg-white rounded-lg shadow-sm">
      <div style={{ height: totalHeight, position: 'relative' }}>
        <table className="min-w-full absolute left-0 top-0" style={{ transform: `translateY(${startIdx * rowHeight}px)` }}>
          <thead className="bg-slate-50"><tr>{columns.map(c => <th key={c.accessor||c.Header} className="px-4 py-3 text-left text-sm font-medium">{c.Header}</th>)}</tr></thead>
          <tbody className="divide-y">
            {visible.map((row, i) => (
              <tr key={startIdx + i} style={{ height: rowHeight }} className="hover:bg-slate-50">
                {columns.map(c => <td key={c.accessor||c.Header} className="px-4 py-3 text-sm align-top">{c.Cell ? c.Cell(row) : (typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* -------------------- Tree Table (expandable rows) -------------------- */
export const TreeTable = ({ columns = [], data = [] }) => {
  const [expanded, setExpanded] = useState(new Set());
  const toggle = (id) => { const s = new Set(expanded); if (s.has(id)) s.delete(id); else s.add(id); setExpanded(s); };

  const renderRows = (nodes, level = 0) => (
    nodes.map((n, i) => (
      <React.Fragment key={n.id ?? `${level}-${i}`}>
        <tr className="hover:bg-slate-50">
          {columns.map((col, ci) => (
            <td key={ci} className="px-4 py-3 text-sm align-top">
              {ci === 0 ? (
                <div style={{ paddingLeft: level * 16 }} className="flex items-center gap-2">
                  {n.children && n.children.length > 0 && <button onClick={() => toggle(n.id)} className="px-1">{expanded.has(n.id) ? '▾' : '▸'}</button>}
                  {col.Cell ? col.Cell(n) : (typeof col.accessor === 'function' ? col.accessor(n) : n[col.accessor])}
                </div>
              ) : (col.Cell ? col.Cell(n) : (typeof col.accessor === 'function' ? col.accessor(n) : n[col.accessor]))}
            </td>
          ))}
        </tr>
        {n.children && n.children.length > 0 && expanded.has(n.id) && renderRows(n.children, level + 1)}
      </React.Fragment>
    ))
  );

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50"><tr>{columns.map(c => <th key={c.accessor||c.Header} className="px-4 py-3 text-left text-sm font-medium">{c.Header}</th>)}</tr></thead>
        <tbody className="divide-y">{renderRows(data)}</tbody>
      </table>
    </div>
  );
};

/* -------------------- Sticky Header Table -------------------- */
export const StickyHeaderTable = ({ columns = [], data = [], height = 400 }) => (
  <div className="bg-white rounded-lg shadow-sm overflow-auto" style={{ maxHeight: height }}>
    <table className="min-w-full">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr>{columns.map(c => <th key={c.accessor||c.Header} className="px-4 py-3 text-left text-sm font-medium">{c.Header}</th>)}</tr>
      </thead>
      <tbody className="divide-y">{data.map((r,i) => <tr key={i} className="hover:bg-slate-50">{columns.map(c => <td key={c.accessor||c.Header} className="px-4 py-3 text-sm align-top">{c.Cell ? c.Cell(r) : (typeof c.accessor === 'function' ? c.accessor(r) : r[c.accessor])}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

/* -------------------- Row Actions & Bulk Actions helper components -------------------- */
export const RowActions = ({ children }) => (
  <div className="flex items-center gap-2">{children}</div>
);

export const BulkActionsBar = ({ selectedCount, onDelete, onExport }) => (
  <div className="bg-slate-50 p-3 rounded-md flex items-center justify-between">
    <div>{selectedCount} selected</div>
    <div className="flex items-center gap-2">
      <button onClick={onExport} className="px-3 py-1 rounded-md border">Export</button>
      <button onClick={onDelete} className="px-3 py-1 rounded-md bg-rose-600 text-white">Delete</button>
    </div>
  </div>
);

/* -------------------- Export helpers -------------------- */
export const ExportCSV = ({ columns = [], rows = [], filename = 'export.csv' }) => {
  return <button onClick={() => downloadCSV(rows, columns, filename)} className="px-3 py-2 rounded-md border">Export CSV</button>;
};

/* -------------------- Default export: Tables Playground -------------------- */
export default function TablesPlayground() {
  const columns = [
    { Header: 'ID', accessor: 'id' },
    { Header: 'Name', accessor: 'name' },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Role', accessor: (r) => r.role || '—' },
  ];
  const data = Array.from({ length: 56 }).map((_, i) => ({ id: i + 1, name: `User ${i+1}`, email: `user${i+1}@example.com`, role: i % 3 === 0 ? 'Admin' : 'User' }));

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <h2 className="text-2xl font-bold">Shreeja ERP Tables</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-2">SimpleTable</h4>
          <SimpleTable columns={columns} data={data.slice(0,5)} />
        </div>

        <div>
          <h4 className="font-semibold mb-2">DataTable (client-side)</h4>
          <DataTable columns={columns} data={data} defaultPageSize={10} selectable />
        </div>

        <div>
          <h4 className="font-semibold mb-2">EditableTable</h4>
          <EditableTable columns={[...columns, { Header: 'Actions', accessor: () => '' }]} data={data.slice(0,6)} onSaveRow={(r,i)=>alert('saved '+r.name)} />
        </div>

        <div>
          <h4 className="font-semibold mb-2">VirtualizedTable (demo)</h4>
          <VirtualizedTable columns={columns} data={data} height={300} />
        </div>
      </div>
    </div>
  );
}
