/*
  buttons.jsx
  Enhanced Math-themed 3D & animated button library for Shreeja ERP
  - TailwindCSS utility classes assumed
  - Framer Motion available for subtle animations
  - Includes math icons, doodles, 3D/neumorphic styles and motion
  - Theme persistence with localStorage
  - Production-ready with accessibility features
*/

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Utility function for conditional class names
const cx = (...classes) => classes.filter(Boolean).join(' ');

// Size mapping
const SIZE_MAP = {
  sm: 'text-xs px-2.5 py-1.5 rounded-md',
  md: 'text-sm px-3 py-2 rounded-md',
  lg: 'text-base px-4 py-2.5 rounded-lg',
};

/* -------------------- Math Icon Components -------------------- */
export const MathPi = (props) => (
  <svg 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.6" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 6h2v8a2 2 0 0 0 2 2h8" />
    <path d="M4 6h16" />
  </svg>
);

export const MathSigma = (props) => (
  <svg 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.6" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    {...props}
  >
    <path d="M20 6H8l6 6-6 6h12" />
  </svg>
);

export const MathIntegral = (props) => (
  <svg 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.6" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3c-3 6-3 12 0 18" />
  </svg>
);

/* -------------------- 3D / Neumorphic Shadow Helpers -------------------- */
const threeD = 'shadow-[0_8px_20px_rgba(6,95,70,0.12)] active:translate-y-0.5 active:shadow-[0_4px_8px_rgba(6,95,70,0.08)] transform-gpu transition-all duration-200';
const soft3D = 'shadow-[0_6px_14px_rgba(2,6,23,0.08)] active:translate-y-0.5 active:shadow-[0_3px_6px_rgba(2,6,23,0.06)] transform-gpu transition-all duration-200';
const heavy3D = 'shadow-[0_10px_25px_rgba(0,0,0,0.15)] active:translate-y-1 active:shadow-[0_5px_12px_rgba(0,0,0,0.1)] transform-gpu transition-all duration-200';

/* -------------------- Base Button Component -------------------- */
export const BaseButton = React.forwardRef(({
  children,
  className = '',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  animateProps,
  variant = 'primary',
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-white text-slate-800 ring-1 ring-slate-100 hover:bg-slate-50';
      case 'danger':
        return 'bg-gradient-to-br from-[#ef4444] to-[#ef6b6b] text-white hover:brightness-105';
      case 'outline':
        return 'bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50';
      case 'glass':
        return 'backdrop-blur-sm bg-white/20 text-white border border-white/10 hover:bg-white/30';
      case 'primary':
      default:
        return 'bg-gradient-to-br from-[#0ea5a4] to-[#0b8793] text-white hover:brightness-105';
    }
  };

  const getShadowClass = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return threeD;
      case 'glass':
        return soft3D;
      default:
        return '';
    }
  };

  return (
    <motion.button
      ref={ref}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      whileTap={{ scale: 0.98, y: 1 }}
      whileHover={{ y: -1 }}
      initial={{ y: 0 }}
      animate={animateProps}
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-300/50',
        'transition-all will-change-transform select-none',
        SIZE_MAP[size],
        getVariantClasses(),
        getShadowClass(),
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100',
        className
      )}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}

      {!loading && LeftIcon && (
        <span className="inline-flex items-center">
          <LeftIcon className="w-5 h-5" />
        </span>
      )}

      <span className={loading ? 'opacity-80' : ''}>{children}</span>

      {!loading && RightIcon && (
        <span className="inline-flex items-center">
          <RightIcon className="w-5 h-5" />
        </span>
      )}
    </motion.button>
  );
});

BaseButton.displayName = 'BaseButton';

/* -------------------- Enhanced Variant Buttons -------------------- */
export const PrimaryBtn = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    variant="primary"
    {...props}
  />
));
PrimaryBtn.displayName = 'PrimaryBtn';

export const SecondaryBtn = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    variant="secondary"
    {...props}
  />
));
SecondaryBtn.displayName = 'SecondaryBtn';

export const DangerBtn = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    variant="danger"
    {...props}
  />
));
DangerBtn.displayName = 'DangerBtn';

export const OutlineBtn = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    variant="outline"
    {...props}
  />
));
OutlineBtn.displayName = 'OutlineBtn';

export const GlassBtn = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    variant="glass"
    {...props}
  />
));
GlassBtn.displayName = 'GlassBtn';

/* -------------------- Math-themed Accent Button -------------------- */
export const PrimaryAlt = React.forwardRef((props, ref) => (
  <BaseButton
    ref={ref}
    {...props}
    className={cx(
      'bg-gradient-to-br from-[#ff8a00] to-[#ff4d4d] text-white',
      'ring-1 ring-white/10',
      heavy3D,
      props.className
    )}
  />
));
PrimaryAlt.displayName = 'PrimaryAlt';

/* -------------------- CRUD Buttons -------------------- */
export const CreateBtn = React.forwardRef((props, ref) => (
  <PrimaryBtn ref={ref} leftIcon={MathPi} {...props}>
    Create
  </PrimaryBtn>
));
CreateBtn.displayName = 'CreateBtn';

export const ViewBtn = React.forwardRef((props, ref) => (
  <SecondaryBtn ref={ref} leftIcon={MathSigma} {...props}>
    View
  </SecondaryBtn>
));
ViewBtn.displayName = 'ViewBtn';

export const EditBtn = React.forwardRef((props, ref) => (
  <PrimaryAlt ref={ref} leftIcon={MathIntegral} {...props}>
    Edit
  </PrimaryAlt>
));
EditBtn.displayName = 'EditBtn';

export const DeleteBtn = React.forwardRef((props, ref) => (
  <DangerBtn ref={ref} {...props}>
    Delete
  </DangerBtn>
));
DeleteBtn.displayName = 'DeleteBtn';

export const SaveBtn = React.forwardRef((props, ref) => (
  <PrimaryBtn ref={ref} {...props}>
    Save
  </PrimaryBtn>
));
SaveBtn.displayName = 'SaveBtn';

export const CancelBtn = React.forwardRef((props, ref) => (
  <OutlineBtn ref={ref} {...props}>
    Cancel
  </OutlineBtn>
));
CancelBtn.displayName = 'CancelBtn';

/* -------------------- Icon-only Button -------------------- */
export const IconBtn = React.forwardRef(({
  icon: Icon,
  label,
  size = 'md',
  className = '',
  doodle = false,
  ...props
}, ref) => (
  <BaseButton
    ref={ref}
    size={size}
    aria-label={label}
    {...props}
    className={cx(
      'rounded-full p-2 hover:bg-slate-50 relative overflow-hidden',
      soft3D,
      className
    )}
  >
    {doodle && (
      <span className="absolute inset-0 pointer-events-none opacity-20">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path 
            fill="url(#g1)" 
            d="M44.2,-55.9C56.5,-46.1,66.6,-34.4,69.6,-21.6C72.7,-8.8,68.8,5.1,61.1,17.1C53.3,29.1,41.7,39.2,29.1,46.4C16.4,53.6,2.8,58,-10.6,59.3C-24,60.6,-38.2,58.8,-49.9,51.2C-61.6,43.6,-70.8,30.1,-74.8,15.5C-78.9,0.9,-77.9,-14.9,-69.3,-26.8C-60.7,-38.8,-44.5,-46.8,-29.2,-54.6C-14,-62.4,0.3,-69.2,14.3,-68.3C28.3,-67.3,56.5,-65.7,44.2,-55.9Z" 
            transform="translate(100 100)" 
          />
        </svg>
      </span>
    )}
    {Icon && <Icon className="w-5 h-5 relative z-10" />}
  </BaseButton>
));
IconBtn.displayName = 'IconBtn';

/* -------------------- Navigation Button -------------------- */
export const NavBtn = React.forwardRef(({ children, active = false, math = false, ...props }, ref) => (
  <BaseButton
    ref={ref}
    {...props}
    className={cx(
      'w-full justify-start px-3 py-2 rounded-md text-sm',
      active 
        ? 'bg-slate-100 font-semibold text-slate-900' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      props.className
    )}
  >
    {math && <MathPi className="w-5 h-5 opacity-90" />}
    {children}
  </BaseButton>
));
NavBtn.displayName = 'NavBtn';

/* -------------------- Toggle Button -------------------- */
export const ToggleBtn = ({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  children,
  size = 'md',
  className = '',
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  const toggle = () => {
    const next = !checked;
    if (!isControlled) setInternalChecked(next);
    onChange?.(next);
  };

  return (
    <BaseButton
      onClick={toggle}
      size={size}
      className={cx(
        'rounded-full px-3 py-1 gap-3 transition-all',
        checked 
          ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white' 
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        className
      )}
    >
      <motion.span 
        layout 
        className={cx(
          'inline-block p-0.5 rounded-full',
          checked ? 'bg-white' : 'bg-slate-400'
        )} 
        style={{ width: 12, height: 12 }}
      />
      <span>{children}</span>
    </BaseButton>
  );
};

/* -------------------- Segmented Control -------------------- */
export const SegmentedControl = ({ 
  options = [], 
  value, 
  onChange, 
  size = 'md' 
}) => {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'px-3 py-1 rounded-md text-sm font-medium transition flex items-center gap-2',
              active ? 'bg-white shadow' : 'hover:bg-slate-50',
              SIZE_MAP[size]
            )}
          >
            {opt.icon && <span className="opacity-90">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- Split Button -------------------- */
export const SplitButton = ({ 
  label, 
  onPrimary, 
  menuItems = [], 
  size = 'md', 
  className = '' 
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cx('inline-flex items-center rounded-md overflow-visible relative', className)}>
      <PrimaryBtn size={size} onClick={onPrimary} className="rounded-r-none border-r-0">
        {label}
      </PrimaryBtn>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cx(
          'bg-gradient-to-br from-[#0ea5a4] to-[#0b8793] text-white',
          'border border-l-0 border-transparent',
          'hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-cyan-300/50',
          'transition-all duration-200',
          SIZE_MAP[size],
          'rounded-l-none'
        )}
        aria-label="More options"
      >
        ▼
      </button>
      
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          className="absolute right-0 top-full mt-2 rounded-lg bg-white shadow-xl z-50 w-48 overflow-hidden ring-1 ring-slate-200"
        >
          {menuItems.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                m.onClick();
                setOpen(false);
              }}
              className="px-4 py-2.5 text-sm w-full text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
            >
              {m.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

/* -------------------- Floating Action Button -------------------- */
export const FAB = ({ 
  icon: Icon, 
  label, 
  onClick, 
  position = 'bottom-right',
  className = '',
  ...props 
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className={cx(
        'fixed rounded-full p-4 shadow-2xl text-white',
        'bg-gradient-to-br from-[#06b6d4] via-[#0ea5a4] to-[#0b8793]',
        heavy3D,
        positionClasses[position],
        className
      )}
      aria-label={label}
      {...props}
    >
      {Icon ? <Icon className="w-6 h-6" /> : label}
    </motion.button>
  );
};

/* -------------------- File Upload Button -------------------- */
export const FileUploadBtn = ({ 
  onChange, 
  accept = '*', 
  children, 
  ...props 
}) => {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer" {...props}>
      <input 
        type="file" 
        accept={accept} 
        onChange={onChange} 
        className="hidden" 
      />
      <PrimaryBtn leftIcon={MathSigma} as="span">
        {children}
      </PrimaryBtn>
    </label>
  );
};

/* -------------------- Theme Hook & Toggle -------------------- */
export const useTheme = (key = 'shreeja_theme') => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    
    try {
      const stored = localStorage.getItem(key);
      if (stored === 'dark' || stored === 'light') return stored;
      
      // Respect system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, theme);
    } catch (e) {
      console.warn('Failed to save theme preference');
    }
    
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme, key]);

  return [theme, setTheme];
};

export const ThemeToggleBtn = ({ 
  size = 'md', 
  className = '' 
}) => {
  const [theme, setTheme] = useTheme();

  return (
    <BaseButton
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      size={size}
      className={cx('gap-2', className)}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </BaseButton>
  );
};

/* -------------------- Button Group -------------------- */
export const ButtonGroup = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={cx('inline-flex items-center rounded-lg overflow-hidden', className)}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          className: cx(
            'rounded-none',
            index === 0 && 'rounded-l-lg',
            index === React.Children.count(children) - 1 && 'rounded-r-lg',
            index !== 0 && 'border-l-0',
            child.props.className
          ),
        });
      })}
    </div>
  );
};

/* -------------------- Loading Button -------------------- */
export const LoadingButton = React.forwardRef(({ isLoading = false, children, ...props }, ref) => {
  return (
    <BaseButton
      ref={ref}
      loading={isLoading}
      disabled={isLoading}
      {...props}
    >
      {children}
    </BaseButton>
  );
});
LoadingButton.displayName = 'LoadingButton';

/* -------------------- Demo Playground -------------------- */
export default function ButtonsPlayground() {
  const [toggle, setToggle] = useState(false);
  const [seg, setSeg] = useState('day');
  const [theme] = useTheme();

  return (
    <div className={cx(
      'p-6 space-y-8 min-h-screen transition-colors duration-300',
      theme === 'dark' 
        ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white' 
        : 'bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900'
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
              ERP Button Library
            </span>
            <span className="text-sm font-normal text-slate-400">(Math Edition)</span>
          </h2>
          <p className="text-slate-500 mt-1">Production-ready button components with math themes</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggleBtn />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Math-themed Variants */}
        <div className="space-y-6 p-6 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <h4 className="font-semibold text-lg">Math-themed CRUD Operations</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <CreateBtn onClick={() => console.log('create')} />
            <ViewBtn onClick={() => console.log('view')} />
            <EditBtn onClick={() => console.log('edit')} />
            <DeleteBtn onClick={() => console.log('delete')} />
          </div>
        </div>

        {/* Actions & Save/Cancel */}
        <div className="space-y-6 p-6 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <h4 className="font-semibold text-lg">Action Buttons</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <SaveBtn onClick={() => alert('saved')} />
            <CancelBtn onClick={() => alert('cancelled')} />
            <FileUploadBtn onChange={(e) => console.log(e.target.files?.[0]?.name)}>
              Upload Data
            </FileUploadBtn>
          </div>
        </div>

        {/* Icon & Sizes */}
        <div className="space-y-6 p-6 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <h4 className="font-semibold text-lg">Icon Buttons & Sizes</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <IconBtn label="Pi" icon={MathPi} doodle />
            <IconBtn label="Sigma" icon={MathSigma} />
            <PrimaryBtn size="sm">Small</PrimaryBtn>
            <PrimaryBtn size="md">Medium</PrimaryBtn>
            <PrimaryBtn size="lg" leftIcon={MathIntegral}>Large</PrimaryBtn>
          </div>
        </div>

        {/* Interactive Components */}
        <div className="space-y-6 p-6 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <h4 className="font-semibold text-lg">Interactive Components</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ToggleBtn checked={toggle} onChange={setToggle}>
                Auto-sync
              </ToggleBtn>
              <SegmentedControl 
                options={[
                  { label: 'Day', value: 'day', icon: <MathPi className="w-4 h-4" /> },
                  { label: 'Week', value: 'week', icon: <MathSigma className="w-4 h-4" /> },
                  { label: 'Month', value: 'month', icon: <MathIntegral className="w-4 h-4" /> }
                ]} 
                value={seg} 
                onChange={setSeg} 
              />
            </div>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <SplitButton
                label="Export Data"
                onPrimary={() => alert('Exporting...')}
                menuItems={[
                  { label: 'Export as CSV', onClick: () => alert('CSV export') },
                  { label: 'Export as PDF', onClick: () => alert('PDF export') },
                  { label: 'Export as Excel', onClick: () => alert('Excel export') },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FAB
        icon={MathIntegral}
        label="Create New"
        onClick={() => alert('Creating new item...')}
      />
    </div>
  );
}

