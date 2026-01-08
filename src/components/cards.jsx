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

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const cx = (...classes) => classes.filter(Boolean).join(' ');

const hoverLift = { hover: { y: -6, scale: 1.01, boxShadow: '0 18px 40px rgba(2,6,23,0.12)' } };
const fadeInUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };
const scaleIn = { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };

/* -------------------- Basic Card Primitives -------------------- */
export const Card = ({ 
  children, 
  className = '', 
  elevated = true, 
  bordered = false, 
  hoverable = true,
  as: Component = 'section',
  animation = {},
  ...props 
}) => {
  const MotionComponent = motion[Component] || motion.div;
  
  return (
    <MotionComponent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={hoverable && elevated ? { y: -4 } : undefined}
      transition={{ duration: 0.2 }}
      className={cx(
        'relative bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden',
        'transition-all duration-300 will-change-transform',
        elevated ? 'shadow-md hover:shadow-lg' : '',
        bordered ? 'border border-slate-100' : '',
        hoverable ? 'cursor-pointer' : '',
        className
      )}
      {...animation}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export const CardHeader = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  right, 
  className = '', 
  dense = false, 
  actions,
  ...props 
}) => {
  const hasContent = title || subtitle || Icon || actions;
  
  if (!hasContent) return null;
  
  return (
    <header
      className={cx(
        'flex items-center justify-between gap-3',
        dense ? 'px-4 py-3' : 'px-5 py-4',
        'border-b border-slate-100',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="flex-shrink-0 p-2 rounded-lg bg-slate-50 shadow-sm">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          {title && (
            <h3 className="text-sm font-semibold text-slate-800 truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {right}
      </div>
    </header>
  );
};

export const CardBody = ({ 
  children, 
  className = '', 
  padding = 'md',
  ...props 
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6'
  };
  
  return (
    <div
      className={cx(paddingClasses[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardFooter = ({ 
  children, 
  className = '', 
  align = 'between',
  ...props 
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  };
  
  return (
    <footer
      className={cx(
        'px-5 py-3 border-t border-slate-100 bg-white/50',
        'flex items-center gap-2',
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </footer>
  );
};

/* -------------------- Grid / Layout Helpers -------------------- */
export const KPIGrid = ({ 
  children, 
  cols = 3, 
  gap = 'gap-4', 
  className = '' 
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };
  
  return (
    <div className={cx('grid', gap, gridClasses[cols], className)}>
      {children}
    </div>
  );
};

/* -------------------- Stat / Metric Cards -------------------- */
export const StatCard = ({ 
  label, 
  value, 
  delta, 
  icon: Icon, 
  className = '', 
  trend = 'neutral', 
  loading = false,
  onClick 
}) => {
  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50',
    down: 'text-rose-600 bg-rose-50',
    neutral: 'text-slate-600 bg-slate-50'
  };
  
  const trendIcons = {
    up: '▲',
    down: '▼',
    neutral: '●'
  };
  
  if (loading) {
    return (
      <div className={cx('p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-sm', className)}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-24" />
            <div className="h-6 bg-slate-200 rounded animate-pulse w-16" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <motion.div
      layout
      initial="initial"
      animate="animate"
      variants={fadeInUp}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cx(
        'p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-sm',
        onClick ? 'cursor-pointer' : '',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 shadow-inner">
            <Icon className="w-6 h-6 text-sky-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 truncate">{label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 truncate">
            {value}
          </div>
        </div>
        {delta !== undefined && (
          <div
            className={cx(
              'flex-shrink-0 text-sm font-semibold px-2 py-1 rounded-full',
              trendColors[trend]
            )}
          >
            {trendIcons[trend]} {Math.abs(delta)}%
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const MetricCard = ({ 
  title, 
  subtitle, 
  chart, 
  actions, 
  className = '', 
  variant = 'default' 
}) => {
  const variantClasses = {
    default: 'p-4',
    compact: 'p-3',
    expanded: 'p-6'
  };
  
  return (
    <Card className={cx(variantClasses[variant], className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-slate-500 truncate">{title}</div>
          <div className="text-lg font-semibold text-slate-900 truncate">
            {subtitle}
          </div>
        </div>
        {chart && (
          <div className="flex-shrink-0 w-36 h-20 flex items-center justify-center">
            {chart}
          </div>
        )}
      </div>
      {actions && (
        <div className="mt-4 flex items-center gap-2">{actions}</div>
      )}
    </Card>
  );
};

/* -------------------- Info / Action Cards -------------------- */
export const InfoCard = ({ 
  title, 
  description, 
  icon: Icon, 
  cta, 
  children, 
  className = '', 
  variant = 'info' 
}) => {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-100',
    success: 'bg-emerald-50 border-emerald-100',
    warning: 'bg-amber-50 border-amber-100',
    error: 'bg-rose-50 border-rose-100'
  };
  
  const variantIcons = {
    info: 'text-blue-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-rose-600'
  };
  
  return (
    <Card className={cx('border', variantStyles[variant], className)}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={cx('flex-shrink-0 p-3 rounded-lg', variantStyles[variant])}>
            <Icon className={cx('w-6 h-6', variantIcons[variant])} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-semibold text-slate-800">{title}</div>
          )}
          {description && (
            <div className="text-sm text-slate-600 mt-1">{description}</div>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
        {cta && <div className="flex-shrink-0">{cta}</div>}
      </div>
    </Card>
  );
};

export const ActionCard = ({ 
  title, 
  subtitle, 
  actions, 
  className = '', 
  icon: Icon,
  ...props 
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cx(
        'w-full text-left p-4 rounded-2xl bg-white shadow-sm',
        'border border-transparent hover:border-slate-200',
        'transition-all duration-200',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-slate-50">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {subtitle && (
              <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
    </motion.button>
  );
};

/* -------------------- List / Profile Cards -------------------- */
export const ListCard = ({ 
  items = [], 
  renderItem, 
  className = '', 
  emptyState,
  loading = false 
}) => {
  if (loading) {
    return (
      <Card className={cx('p-0', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-slate-100">
            <div className="h-4 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </Card>
    );
  }
  
  if (!items.length && emptyState) {
    return (
      <Card className={cx('p-6 text-center', className)}>
        {emptyState}
      </Card>
    );
  }
  
  return (
    <Card className={cx('p-0', className)}>
      <div className="divide-y divide-slate-100">
        {items.map((item, index) => (
          <div
            key={index}
            className="px-5 py-4 hover:bg-slate-50 transition-colors duration-150"
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </Card>
  );
};

export const ProfileCard = ({ 
  name, 
  role, 
  avatar, 
  stats = [], 
  actions, 
  className = '', 
  avatarSize = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };
  
  return (
    <Card className={cx('p-5 text-center', className)}>
      <div className="flex flex-col items-center gap-3">
        <div className={cx(
          'rounded-full overflow-hidden bg-slate-100 shadow-inner',
          'flex items-center justify-center',
          sizeClasses[avatarSize]
        )}>
          {avatar}
        </div>
        <div>
          <div className="text-lg font-semibold">{name}</div>
          <div className="text-sm text-slate-500">{role}</div>
        </div>

        {stats.length > 0 && (
          <div className="mt-4 w-full grid grid-cols-2 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xs text-slate-500">{stat.label}</div>
                <div className="font-semibold text-slate-900">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {actions && (
          <div className="mt-4 flex items-center gap-2 w-full">
            {actions}
          </div>
        )}
      </div>
    </Card>
  );
};

/* -------------------- Expandable / Collapsible Cards -------------------- */
export const ExpandableCard = ({ 
  title, 
  preview, 
  details, 
  defaultOpen = false, 
  className = '', 
  onToggle 
}) => {
  const [open, setOpen] = useState(defaultOpen);
  
  const handleToggle = () => {
    const newState = !open;
    setOpen(newState);
    onToggle?.(newState);
  };
  
  return (
    <Card className={cx('p-0 overflow-hidden', className)}>
      <button
        onClick={handleToggle}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {preview && (
            <div className="text-xs text-slate-500 mt-1">{preview}</div>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400"
        >
          ▼
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 border-t border-slate-100">
              {details}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export const CollapsibleCard = ({ 
  title, 
  children, 
  className = '', 
  defaultOpen = true, 
  onToggle 
}) => {
  const [open, setOpen] = useState(defaultOpen);
  
  const handleToggle = () => {
    const newState = !open;
    setOpen(newState);
    onToggle?.(newState);
  };
  
  return (
    <Card className={cx('p-0', className)}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="text-sm font-semibold">{title}</div>
        <button
          onClick={handleToggle}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

/* -------------------- Specialized ERP Cards -------------------- */
export const TransactionCard = ({ 
  title, 
  amount, 
  status, 
  date, 
  actions, 
  className = '', 
  onClick 
}) => {
  const statusColors = {
    paid: 'text-emerald-600 bg-emerald-50',
    pending: 'text-amber-600 bg-amber-50',
    failed: 'text-rose-600 bg-rose-50',
    refunded: 'text-slate-600 bg-slate-50'
  };
  
  const statusIcons = {
    paid: '✓',
    pending: '⏳',
    failed: '✗',
    refunded: '↩'
  };
  
  return (
    <Card
      className={cx(
        'p-4 flex items-center justify-between gap-4',
        onClick ? 'cursor-pointer' : '',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={cx(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
          statusColors[status]
        )}>
          {statusIcons[status]}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-xs text-slate-400">{date}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-semibold">{amount}</div>
          <div className={cx(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            statusColors[status]
          )}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </Card>
  );
};

export const InvoiceCard = ({ 
  invoiceNo, 
  client, 
  due, 
  amount, 
  status, 
  className = '', 
  onClick 
}) => {
  const statusColors = {
    paid: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    pending: 'text-amber-600 border-amber-200 bg-amber-50',
    overdue: 'text-rose-600 border-rose-200 bg-rose-50'
  };
  
  return (
    <Card
      className={cx('p-4', onClick ? 'cursor-pointer' : '', className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500">Invoice #{invoiceNo}</div>
          <div className="text-sm font-medium truncate mt-1">{client}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-slate-500">Due {due}</div>
          <div className="text-lg font-semibold mt-1">{amount}</div>
          <div className={cx(
            'text-xs font-medium px-2 py-1 rounded-full border mt-2 inline-block',
            statusColors[status]
          )}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const NotificationCard = ({ 
  title, 
  body, 
  time, 
  unread = false, 
  onClick, 
  className = '', 
  type = 'info' 
}) => {
  const typeColors = {
    info: 'bg-blue-50 border-blue-100',
    success: 'bg-emerald-50 border-emerald-100',
    warning: 'bg-amber-50 border-amber-100',
    error: 'bg-rose-50 border-rose-100'
  };
  
  return (
    <div
      role="button"
      onClick={onClick}
      className={cx(
        'p-4 rounded-2xl cursor-pointer transition-all duration-200',
        'border hover:shadow-sm',
        unread ? typeColors[type] : 'bg-white border-slate-100',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {unread && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
            <div className="text-sm font-semibold truncate">{title}</div>
          </div>
          <div className="text-sm text-slate-600 mt-1 line-clamp-2">
            {body}
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-slate-400">{time}</div>
      </div>
    </div>
  );
};

/* -------------------- Carousel / Timeline Cards -------------------- */
export const CarouselCard = ({ 
  items = [], 
  renderItem, 
  className = '', 
  autoPlay = false, 
  interval = 5000,
  showControls = true,
  showIndicators = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);
  
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };
  
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };
  
  useEffect(() => {
    if (!autoPlay) return;
    
    timerRef.current = setInterval(nextSlide, interval);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoPlay, interval]);
  
  if (!items.length) return null;
  
  return (
    <Card className={cx('p-0 overflow-hidden', className)}>
      <div className="relative">
        <div className="overflow-hidden">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            {renderItem(items[currentIndex], currentIndex)}
          </motion.div>
        </div>
        
        {showControls && items.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white"
              aria-label="Previous slide"
            >
              ◀
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white"
              aria-label="Next slide"
            >
              ▶
            </button>
          </>
        )}
        
        {showIndicators && items.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={cx(
                  'w-2 h-2 rounded-full transition-all',
                  idx === currentIndex 
                    ? 'bg-slate-900 w-4' 
                    : 'bg-slate-300 hover:bg-slate-400'
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export const TimelineCard = ({ 
  events = [], 
  className = '', 
  title 
}) => {
  const variantColors = {
    default: 'bg-slate-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500'
  };
  
  return (
    <Card className={cx('p-4', className)}>
      {title && (
        <div className="text-sm font-semibold text-slate-800 mb-4">
          {title}
        </div>
      )}
      
      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className={cx(
                'w-3 h-3 rounded-full',
                variantColors[event.variant || 'default']
              )} />
              {index !== events.length - 1 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-200" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{event.title}</div>
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {event.time}
                </div>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {event.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* -------------------- Loading / Skeleton Cards -------------------- */
export const LoadingCard = ({ 
  className = '', 
  lines = 2, 
  variant = 'simple' 
}) => {
  if (variant === 'detailed') {
    return (
      <div className={cx(
        'p-4 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50',
        'animate-pulse',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded bg-slate-200 w-3/4" />
            <div className="h-3 rounded bg-slate-200 w-1/2" />
          </div>
        </div>
        {lines > 1 && (
          <div className="mt-4 space-y-2">
            {Array.from({ length: lines - 1 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-slate-200 w-full" />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={cx(
      'p-4 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50',
      'animate-pulse',
      className
    )}>
      <div className="h-4 rounded bg-slate-200 w-3/4 mb-3" />
      <div className="h-3 rounded bg-slate-200 w-1/2" />
    </div>
  );
};

export const CardSkeleton = ({ 
  lines = 3, 
  className = '' 
}) => {
  return (
    <div className={cx(
      'p-4 rounded-2xl bg-white/50 animate-pulse',
      className
    )}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cx(
            'h-3 bg-slate-200 rounded my-2',
            i === 0 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
};

/* -------------------- Dashboard Grid -------------------- */
export const DashboardGrid = ({ 
  children, 
  className = '', 
  layout = 'auto' 
}) => {
  const layoutClasses = {
    auto: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    dense: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    fixed: 'grid-cols-1 lg:grid-cols-2'
  };
  
  return (
    <div className={cx(
      'grid gap-4 md:gap-6',
      layoutClasses[layout],
      className
    )}>
      {children}
    </div>
  );
};

/* -------------------- Export All Components -------------------- */
