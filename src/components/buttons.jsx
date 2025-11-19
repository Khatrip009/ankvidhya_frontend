/*
  buttons.jsx
  Enhanced Math-themed 3D & animated button library for Shreeja ERP
  - TailwindCSS utility classes assumed
  - Framer Motion available for subtle animations
  - Includes math icons, doodles, 3D / neumorphic styles and motion
  - Exports same public API as before but with upgraded visuals
  - Added: CRUD buttons and a theme toggle (dark / light) with persistence
*/

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const cx = (...c) => c.filter(Boolean).join(' ');

const SIZE_MAP = {
  sm: 'text-xs px-2.5 py-1.5 rounded-md',
  md: 'text-sm px-3 py-2 rounded-md',
  lg: 'text-base px-4 py-2.5 rounded-lg',
};

/* -------------------- Decorative math SVGs / doodles -------------------- */
const MathPi = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path d="M4 6h2v8a2 2 0 0 0 2 2h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M4 6h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
const MathSigma = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path d="M20 6H8l6 6-6 6h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
const MathIntegral = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path d="M12 3c-3 6-3 12 0 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* -------------------- 3D / Neumorphic shadow helpers -------------------- */
const threeD = 'shadow-[0_8px_20px_rgba(6,95,70,0.12)] active:translate-y-0.5 active:shadow-[0_4px_8px_rgba(6,95,70,0.08)] transform-gpu';
const soft3D = 'shadow-[0_6px_14px_rgba(2,6,23,0.08)] active:translate-y-0.5 active:shadow-[0_3px_6px_rgba(2,6,23,0.06)] transform-gpu';

/* -------------------- Base Button (with 3D look & motion) -------------------- */
export const BaseButton = React.forwardRef(({
  children,
  className = '',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  animateProps = {},
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  return (
    <motion.button
      ref={ref}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      whileTap={{ scale: 0.98, y: 1 }}
      initial={{ y: 0 }}
      animate={animateProps}
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all will-change-transform',
        SIZE_MAP[size],
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}

      {!loading && LeftIcon ? <span className="-ml-0.5 inline-flex items-center"><LeftIcon className="w-5 h-5" /></span> : null}

      <span className={loading ? 'opacity-80' : ''}>{children}</span>

      {!loading && RightIcon ? <span className="-mr-0.5 inline-flex items-center"><RightIcon className="w-5 h-5" /></span> : null}
    </motion.button>
  );
});

/* -------------------- Enhanced Variants -------------------- */
export const PrimaryBtn = (props) => (
  <BaseButton
    {...props}
    className={cx(
      'bg-gradient-to-br from-[#0ea5a4] to-[#0b8793] text-white',
      threeD,
      'border border-transparent',
      'hover:brightness-105 focus:ring-cyan-300',
      props.className
    )}
  />
);

export const PrimaryAlt = (props) => (
  <BaseButton
    {...props}
    className={cx(
      'bg-gradient-to-br from-[#ff8a00] to-[#ff4d4d] text-white',
      'ring-1 ring-white/10',
      soft3D,
      props.className
    )}
  />
);

export const SecondaryBtn = (props) => (
  <BaseButton
    {...props}
    className={cx('bg-white text-slate-800 ring-1 ring-slate-100', soft3D, props.className)}
  />
);

export const GlassBtn = (props) => (
  <BaseButton
    {...props}
    className={cx('backdrop-blur-sm bg-white/20 text-white border border-white/10', soft3D, props.className)}
  />
);

export const DangerBtn = (props) => (
  <BaseButton {...props} className={cx('bg-gradient-to-br from-[#ef4444] to-[#ef6b6b] text-white', threeD, props.className)} />
);

export const OutlineBtn = (props) => (
  <BaseButton {...props} className={cx('bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50', props.className)} />
);

/* -------------------- CRUD Buttons -------------------- */
export const CreateBtn = (props) => (
  <PrimaryBtn leftIcon={MathPi} {...props}>Create</PrimaryBtn>
);
export const ViewBtn = (props) => (
  <SecondaryBtn leftIcon={MathSigma} {...props}>View</SecondaryBtn>
);
export const EditBtn = (props) => (
  <PrimaryAlt leftIcon={MathIntegral} {...props}>Edit</PrimaryAlt>
);
export const DeleteBtn = (props) => (
  <DangerBtn {...props}>Delete</DangerBtn>
);
export const SaveBtn = (props) => (
  <PrimaryBtn {...props}>Save</PrimaryBtn>
);
export const CancelBtn = (props) => (
  <OutlineBtn {...props}>Cancel</OutlineBtn>
);

/* -------------------- Icon-only and Nav Buttons with doodles -------------------- */
export const IconBtn = ({ icon: Icon, label, size = 'md', className = '', doodle = false, ...props }) => (
  <BaseButton
    {...props}
    size={size}
    aria-label={label}
    className={cx('rounded-full p-2 hover:bg-slate-50 relative overflow-hidden', soft3D, className)}
  >
    {doodle && <span className="absolute inset-0 pointer-events-none opacity-20">{/* decorative SVG blob */}
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path fill="url(#g1)" d="M44.2,-55.9C56.5,-46.1,66.6,-34.4,69.6,-21.6C72.7,-8.8,68.8,5.1,61.1,17.1C53.3,29.1,41.7,39.2,29.1,46.4C16.4,53.6,2.8,58,-10.6,59.3C-24,60.6,-38.2,58.8,-49.9,51.2C-61.6,43.6,-70.8,30.1,-74.8,15.5C-78.9,0.9,-77.9,-14.9,-69.3,-26.8C-60.7,-38.8,-44.5,-46.8,-29.2,-54.6C-14,-62.4,0.3,-69.2,14.3,-68.3C28.3,-67.3,56.5,-65.7,44.2,-55.9Z" transform="translate(100 100)" />
      </svg>
    </span>}
    {Icon ? <Icon className="w-5 h-5 relative z-10" /> : null}
  </BaseButton>
);

export const NavBtn = ({ children, active = false, math = false, ...props }) => (
  <BaseButton
    {...props}
    className={cx(
      'w-full justify-start px-3 py-2 rounded-md text-sm flex items-center gap-3',
      active ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50',
      props.className
    )}
  >
    {math ? <MathPi className="w-5 h-5 opacity-90" /> : null}
    {children}
  </BaseButton>
);

/* -------------------- Toggle Button (pill with 3D indicator) -------------------- */
export const ToggleBtn = ({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  children,
  size = 'md',
  className = '',
}) => {
  const [checked, setChecked] = useState(controlledChecked ?? defaultChecked);
  const isControlled = controlledChecked !== undefined;

  const toggle = () => {
    const next = !checked;
    if (!isControlled) setChecked(next);
    onChange && onChange(next);
  };

  const active = isControlled ? controlledChecked : checked;
  return (
    <BaseButton onClick={toggle} size={size} className={cx('rounded-full px-3 py-1 gap-3', active ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700', className)}>
      <motion.span layout className={cx('inline-block p-0.5 rounded-full', active ? 'bg-white' : 'bg-slate-500')} style={{ width: 12, height: 12 }} />
      <span>{children}</span>
    </BaseButton>
  );
};

/* -------------------- Segmented Control (math doodle variant) -------------------- */
export const SegmentedControl = ({ options = [], value, onChange, size = 'md' }) => {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cx(
              'px-3 py-1 rounded-md text-sm font-medium transition flex items-center gap-2',
              active ? 'bg-white shadow' : 'hover:bg-slate-50',
              SIZE_MAP[size]
            )}
          >
            {opt.icon ? <span className="opacity-90 -ml-1">{opt.icon}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- Split Button (keeps same api) -------------------- */
export const SplitButton = ({ label, onPrimary, menuItems = [], size = 'md', className = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx('inline-flex items-center rounded-md overflow-visible relative', className)}>
      <PrimaryBtn size={size} onClick={onPrimary} className="rounded-r-none">{label}</PrimaryBtn>
      <SecondaryBtn size={size} onClick={() => setOpen((s) => !s)} className="rounded-l-none border-l-0">▼</SecondaryBtn>
      {open && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="absolute right-0 mt-2 rounded-lg bg-white shadow-lg z-40 w-40 overflow-hidden">
          {menuItems.map((m, i) => (
            <button key={i} onClick={() => { m.onClick && m.onClick(); setOpen(false); }} className="px-4 py-2 text-sm w-full text-left hover:bg-slate-50">{m.label}</button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

/* -------------------- Floating Action Button (3D & animated) -------------------- */
export const FAB = ({ icon: Icon, label, onClick, className = '' }) => (
  <motion.button onClick={onClick} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className={cx('fixed right-6 bottom-6 rounded-full p-4 shadow-2xl text-white', 'bg-gradient-to-br from-[#06b6d4] to-[#0ea5a4]', threeD, className)} aria-label={label}>
    {Icon ? <Icon className="w-6 h-6" /> : label}
  </motion.button>
);

/* -------------------- File Upload Button (math doodle icon) -------------------- */
export const FileUploadBtn = ({ onChange, accept = '*', children }) => {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="file" accept={accept} onChange={onChange} className="hidden" />
      <PrimaryBtn leftIcon={MathSigma}>{children}</PrimaryBtn>
    </label>
  );
};

/* -------------------- Theme Toggle (dark / light) -------------------- */
export const useTheme = (key = 'shreeja_theme') => {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
      // default: respect prefers-color-scheme
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, theme);
    } catch (e) {}
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, [theme, key]);

  return [theme, setTheme];
};

export const ThemeToggleBtn = ({ size = 'md', className = '' }) => {
  const [theme, setTheme] = useTheme();
  return (
    <BaseButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} size={size} className={cx('gap-2', className)} aria-label="Toggle theme">
      {theme === 'dark' ? <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </BaseButton>
  );
};

/* -------------------- Demo Playground (mathy & animated) -------------------- */
export default function ButtonsPlayground() {
  const [toggle, setToggle] = useState(false);
  const [seg, setSeg] = useState('day');
  const [theme] = useTheme();

  return (
    <div className={cx('p-6 space-y-6 min-h-screen', theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900')}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">ERP Button Library <span className="text-sm text-slate-400">(Math Edition)</span></h2>
        <div className="flex items-center gap-3">
          <ThemeToggleBtn />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold">Math-themed Variants</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <CreateBtn onClick={() => alert('create clicked')} />
            <ViewBtn onClick={() => alert('view clicked')} />
            <EditBtn onClick={() => alert('edit clicked')} />
            <DeleteBtn onClick={() => confirm('Are you sure?') && alert('deleted')} />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Actions & Save/Cancel</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <SaveBtn onClick={() => alert('saved')} />
            <CancelBtn onClick={() => alert('cancelled')} />
            <FileUploadBtn onChange={(e) => alert(e.target.files[0]?.name ?? 'no file')}>Upload Data</FileUploadBtn>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Icon, Doodle & Sizes</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <IconBtn label="Pi" icon={MathPi} doodle />
            <IconBtn label="Sigma" icon={MathSigma} doodle />
            <PrimaryBtn size="sm">Small</PrimaryBtn>
            <PrimaryBtn size="lg" leftIcon={MathIntegral}>Large</PrimaryBtn>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Toggle & Segmented</h4>
          <div className="flex items-center gap-3">
            <ToggleBtn checked={toggle} onChange={(v) => setToggle(v)}>Auto-sync</ToggleBtn>
            <SegmentedControl options={[{label:'Day',value:'day',icon:<MathPi/>},{label:'Week',value:'week',icon:<MathSigma/>},{label:'Month',value:'month',icon:<MathIntegral/>}]} value={seg} onChange={setSeg} />
          </div>
        </div>

      </div>
    </div>
  );
}
