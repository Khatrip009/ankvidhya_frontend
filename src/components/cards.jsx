/*
  cards.jsx
  ERP-grade Card component library for Shreeja ERP

  Features:
  - Highly polished, responsive, and accessible card primitives
  - Rich animations using Framer Motion (hover, entrance, layout) and tasteful micro-interactions
  - Ready-made ERP-focused cards: StatCard, MetricCard, KPIGrid, InfoCard, ActionCard,
    ListCard, ProfileCard, ExpandableCard, CollapsibleCard, CarouselCard, TimelineCard,
    TransactionCard, InvoiceCard, NotificationCard, LoadingCard, CardSkeleton
  - Composable parts: Card, CardHeader, CardBody, CardFooter
  - All components are lightweight, tailwind-first, and accept className + style overrides

  Usage:
    import { StatCard, MetricCard, CardHeader } from './cards';

  Note: Framer Motion and TailwindCSS are assumed to be available in the project.
*/

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ERPIcons from './icons';

const cx = (...c) => c.filter(Boolean).join(' ');

const hoverLift = { hover: { y: -6, scale: 1.01, boxShadow: '0 18px 40px rgba(2,6,23,0.12)' } };
const fadeInUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };

/* -------------------- Basic Card primitives -------------------- */
export const Card = ({ children, className = '', elevated = true, bordered = false, role = 'region', ariaLabel }) => (
  <motion.section
    role={role}
    aria-label={ariaLabel}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    whileHover={elevated ? { translateY: -4 } : undefined}
    className={cx(
      'relative bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden transition-transform will-change-transform',
      elevated ? 'shadow-md' : '',
      bordered ? 'border border-slate-100' : '',
      className
    )}
  >
    {children}
  </motion.section>
);

export const CardHeader = ({ title, subtitle, icon: Icon, right, className = '', dense = false }) => (
  <header className={cx('flex items-center justify-between gap-3 px-5', dense ? 'py-2' : 'py-4', 'border-b border-slate-100', className)}>
    <div className="flex items-center gap-3">
      {Icon && <div className="p-2 rounded-lg bg-slate-50 shadow-sm"><Icon className="w-5 h-5" /></div>}
      <div>
        {title && <div className="text-sm font-semibold text-slate-800">{title}</div>}
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </header>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={cx('p-5', className)}>{children}</div>
);

export const CardFooter = ({ children, className = '' }) => (
  <footer className={cx('px-5 py-3 border-t border-slate-100 bg-white/50', className)}>{children}</footer>
);

/* -------------------- Grid / Layout helpers -------------------- */
export const KPIGrid = ({ children, cols = 3, gap = 'gap-4', className = '' }) => (
  <div className={cx('grid', className, gap, cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 md:grid-cols-2' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4')}>
    {children}
  </div>
);

/* -------------------- Stat / Metric Cards -------------------- */
export const StatCard = ({ label, value, delta, icon: Icon, className = '', trend = 'up' }) => (
  <motion.div layout initial="initial" animate="animate" variants={fadeInUp} whileHover="hover" className={cx('p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-sm', className)}>
    <div className="flex items-center gap-4">
      {Icon && <div className="p-3 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 shadow-inner"><Icon className="w-6 h-6 text-sky-600" /></div>}
      <div className="flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      </div>
      {delta !== undefined && (
        <div className={cx('text-sm font-semibold self-center', Number(delta) >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {Number(delta) >= 0 ? '▲' : '▼'} {Math.abs(delta)}
        </div>
      )}
    </div>
  </motion.div>
);

export const MetricCard = ({ title, subtitle, chart, actions, className = '' }) => (
  <Card className={cx('p-4', className)}>
    <div className="flex items-center justify-between gap-4">
      <div>
        {title && <div className="text-sm text-slate-500">{title}</div>}
        {subtitle && <div className="text-lg font-semibold text-slate-900">{subtitle}</div>}
      </div>
      {chart && <div className="w-36 h-20">{chart}</div>}
    </div>
    {actions && <div className="mt-4 flex gap-2">{actions}</div>}
  </Card>
);

/* -------------------- Info / Action Cards -------------------- */
export const InfoCard = ({ title, description, icon: Icon, cta, children, className = '' }) => (
  <Card className={cx('p-5', className)}>
    <div className="flex items-start gap-4">
      {Icon && <div className="p-3 rounded-lg bg-slate-50"><Icon className="w-6 h-6 text-slate-700" /></div>}
      <div className="flex-1">
        {title && <div className="text-sm font-semibold text-slate-800">{title}</div>}
        {description && <div className="text-sm text-slate-500 mt-1">{description}</div>}
        {children && <div className="mt-3">{children}</div>}
      </div>
      {cta && <div>{cta}</div>}
    </div>
  </Card>
);

export const ActionCard = ({ title, subtitle, actions, className = '' }) => (
  <motion.div whileHover={{ scale: 1.01 }} className={cx('p-4 rounded-2xl bg-white shadow-sm', className)}>
    <div className="flex items-center justify-between">
      <div>
        {title && <div className="text-sm font-semibold">{title}</div>}
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </motion.div>
);

/* -------------------- List / Profile Cards -------------------- */
export const ListCard = ({ items = [], renderItem, className = '' }) => (
  <Card className={cx('p-0', className)}>
    <div className="divide-y divide-slate-100">
      {items.map((it, i) => (
        <div key={i} className="px-5 py-3 hover:bg-slate-50 transition-colors">{renderItem ? renderItem(it, i) : JSON.stringify(it)}</div>
      ))}
    </div>
  </Card>
);

export const ProfileCard = ({ name, role, avatar, stats = [], actions, className = '' }) => (
  <Card className={cx('p-5 text-center', className)}>
    <div className="flex flex-col items-center gap-3">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 shadow-inner flex items-center justify-center">{avatar}</div>
      <div className="text-lg font-semibold">{name}</div>
      <div className="text-sm text-slate-500">{role}</div>

      {stats.length > 0 && (
        <div className="mt-4 w-full grid grid-cols-2 gap-2">
          {stats.map((s, idx) => (
            <div key={idx} className="text-left">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="font-medium">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  </Card>
);

/* -------------------- Expandable / Collapsible Cards -------------------- */
export const ExpandableCard = ({ title, preview, details, defaultOpen = false, className = '' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={cx('p-0 overflow-hidden', className)}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {preview && <div className="text-xs text-slate-500">{preview}</div>}
        </div>
        <div className="text-slate-400">{open ? <span aria-hidden>▲</span> : <span aria-hidden>▼</span>}</div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div {...fadeInUp} className="px-5 py-3 border-t border-slate-100">
            {details}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export const CollapsibleCard = ({ title, children, className = '' }) => {
  const [open, setOpen] = useState(true);
  return (
    <Card className={cx('p-0', className)}>
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <button onClick={() => setOpen(o => !o)} className="text-sm text-slate-500">{open ? 'Collapse' : 'Expand'}</button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 pb-4">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

/* -------------------- Specialized ERP Cards -------------------- */
export const TransactionCard = ({ title, amount, status, date, actions, className = '' }) => (
  <Card className={cx('p-4 flex items-center justify-between gap-4', className)}>
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-slate-400">{date}</div>
    </div>
    <div className="text-right">
      <div className={cx('font-semibold', status === 'paid' ? 'text-emerald-600' : status === 'pending' ? 'text-amber-600' : 'text-rose-600')}>{amount}</div>
      {actions && <div className="mt-1">{actions}</div>}
    </div>
  </Card>
);

export const InvoiceCard = ({ invoiceNo, client, due, amount, status, className = '' }) => (
  <Card className={cx('p-4', className)}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-slate-500">Invoice</div>
        <div className="font-medium">#{invoiceNo} • {client}</div>
      </div>
      <div className="text-right">
        <div className="text-sm">Due {due}</div>
        <div className={cx('font-semibold text-lg', status === 'paid' ? 'text-emerald-600' : 'text-rose-600')}>{amount}</div>
      </div>
    </div>
  </Card>
);

export const NotificationCard = ({ title, body, time, unread = false, onClick, className = '' }) => (
  <div role="button" onClick={onClick} className={cx('p-4 rounded-2xl cursor-pointer transition-colors', unread ? 'bg-sky-50' : 'bg-white', className)}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-500 mt-1">{body}</div>
      </div>
      <div className="text-xs text-slate-400">{time}</div>
    </div>
  </div>
);

/* -------------------- Carousel / Timeline helpers (lightweight) -------------------- */
export const CarouselCard = ({ items = [], renderItem, className = '' }) => {
  const [idx, setIdx] = useState(0);
  const next = () => setIdx(i => (i + 1) % items.length);
  const prev = () => setIdx(i => (i - 1 + items.length) % items.length);
  if (!items.length) return null;
  return (
    <Card className={cx('p-4', className)}>
      <div className="flex items-center justify-between">
        <button onClick={prev} aria-label="Previous">◀</button>
        <div className="flex-1 px-4">{renderItem(items[idx], idx)}</div>
        <button onClick={next} aria-label="Next">▶</button>
      </div>
    </Card>
  );
};

export const TimelineCard = ({ events = [], className = '' }) => (
  <Card className={cx('p-4', className)}>
    <div className="space-y-4">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-2 h-2 bg-sky-500 rounded-full mt-2" />
          <div>
            <div className="text-sm font-semibold">{e.title}</div>
            <div className="text-xs text-slate-500">{e.time}</div>
            <div className="text-sm mt-1">{e.body}</div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

/* -------------------- Loading / Skeleton -------------------- */
export const LoadingCard = ({ className = '' }) => (
  <div className={cx('p-4 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 animate-pulse', className)}>
    <div className="h-4 rounded bg-slate-200 w-3/4 mb-3"></div>
    <div className="h-3 rounded bg-slate-200 w-1/2"></div>
  </div>
);

export const CardSkeleton = ({ lines = 3, className = '' }) => (
  <div className={cx('p-4 rounded-2xl bg-white/50 animate-pulse', className)}>
    {Array.from({ length: lines }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded my-2"></div>)}
  </div>
);

/* -------------------- Demo playground (default) -------------------- */
export default function CardsPlayground() {
  return (
    <div className="p-8 bg-gradient-to-b from-slate-50 to-white min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold">ERP-grade Cards — Shreeja ERP</h2>
        <p className="text-slate-500">A production-ready set of card components with responsive layouts and smooth animations.</p>

        <KPIGrid cols={3} gap="gap-6">
          <StatCard label="Active Users" value="5,430" delta={+124} icon={ERPIcons.Users} />
          <StatCard label="Open Orders" value="324" delta={-12} icon={ERPIcons.Cart} />
          <MetricCard title="Revenue (30d)" subtitle="$128.4k" chart={<div className="h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded" />} actions={<button className="px-3 py-1 rounded bg-sky-600 text-white">View</button>} />
        </KPIGrid>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExpandableCard title="Monthly Summary" preview="Tap to expand" details={<div>Place charts, tables and actions here.</div>} />
          <ListCard items={[{name:'Order #342'},{name:'Order #341'},{name:'Order #340'}]} renderItem={(it)=> <div className="flex items-center justify-between"><div>{it.name}</div><div className="text-xs text-slate-400">More</div></div>} />
        </div>

      </div>
    </div>
  );
}
