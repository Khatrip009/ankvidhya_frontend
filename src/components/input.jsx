/*
  input-components.jsx
  Polished, production-ready input component library for Shreeja ERP

  (same header comments as before)
*/

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const cx = (...c) => c.filter(Boolean).join(' ');

/* design tokens */
const sizes = {
  sm: 'text-sm px-3 py-2 rounded-md',
  md: 'text-base px-4 py-2.5 rounded-lg',
  lg: 'text-lg px-5 py-3 rounded-xl',
};

/* FormField */
export const FormField = ({ id, label, help, required = false, error, children, className = '', inlineLabel = false }) => {
  return (
    <div className={cx('group', className)}>
      {label && (
        <label htmlFor={id} className={cx('block text-sm font-medium transition-colors', inlineLabel ? 'mb-0' : 'mb-2 text-slate-700')}>
          <span className="flex items-center gap-2">
            <span>{label}</span>
            {required && <span className="text-rose-600">*</span>}
            {error && <span className="ml-2 text-xs text-rose-600">{error}</span>}
          </span>
        </label>
      )}

      <div className={cx('relative')}>{children}</div>

      {help && !error && <p className="mt-2 text-xs text-slate-500">{help}</p>}
    </div>
  );
};

const baseInput = (size, status) => cx(
  'w-full bg-white/80 backdrop-blur-sm border transition focus:outline-none shadow-[0_6px_18px_rgba(2,6,23,0.06)]',
  sizes[size] || sizes.md,
  'placeholder:text-slate-400',
  status === 'error' ? 'border-rose-200 ring-rose-100 focus:ring-2' : 'border-slate-200 focus:ring-2 ring-sky-100',
);

/* TextInput */
export const TextInput = React.forwardRef(({ id, value, defaultValue, onChange, placeholder = '', disabled = false, icon: Icon, clearable = false, type = 'text', ariaLabel, className = '', size = 'md', status, prefix, suffix, autoFocus=false, ...props }, ref) => {
  const [val, setVal] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);
  const localRef = ref || useRef();

  const handleChange = (e) => {
    setVal(e.target.value);
    onChange && onChange(e.target.value, e);
  };
  const clear = (e) => { e && e.stopPropagation(); setVal(''); onChange && onChange('', null); localRef.current && localRef.current.focus(); };

  return (
    <div className={cx('relative flex items-center', disabled ? 'opacity-60' : '')}>
      {prefix && <div className="mr-2 select-none text-slate-600">{prefix}</div>}

      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Icon className="w-4 h-4" /></div>}

      <motion.input
        ref={localRef}
        id={id}
        type={type}
        value={val}
        autoFocus={autoFocus}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cx(
          baseInput(size, status),
          Icon ? 'pl-10' : '',
          clearable ? 'pr-10' : '',
          className
        )}
        whileFocus={{ scale: 1.00 }}
        {...props}
      />

      {clearable && val && (
        <button aria-label="Clear" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">✕</button>
      )}

      {suffix && <div className="ml-2 select-none text-slate-600">{suffix}</div>}
    </div>
  );
});

/* NumberInput */
export const NumberInput = ({ id, value, defaultValue, onChange, placeholder = '', disabled = false, step = 1, min, max, className = '', size='md', status }) => {
  const [val, setVal] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);

  const handleChange = (e) => {
    const v = e.target.value === '' ? '' : Number(e.target.value);
    setVal(v);
    onChange && onChange(v, e);
  };

  return (
    <input id={id} type="number" value={val} onChange={handleChange} placeholder={placeholder} disabled={disabled} step={step} min={min} max={max}
      className={cx(baseInput(size, status), className)} />
  );
};

/* TextArea */
export const TextArea = React.forwardRef(({ id, value, defaultValue, onChange, placeholder = '', rows = 4, className = '', size='md', status, ...props }, ref) => {
  const [val, setVal] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);

  const handleChange = (e) => { setVal(e.target.value); onChange && onChange(e.target.value, e); };
  return (
    <motion.textarea id={id} ref={ref} value={val} onChange={handleChange} placeholder={placeholder} rows={rows} className={cx(baseInput(size, status), 'min-h-[120px]', className)} {...props} />
  );
});

/* Select */
export const Select = ({ id, value, defaultValue, onChange, options = [], placeholder = 'Select...', disabled = false, className = '', multiple = false, size='md', status }) => {
  const [val, setVal] = useState(value ?? defaultValue ?? (multiple ? [] : ''));
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);

  const handleChange = (e) => {
    const v = multiple ? Array.from(e.target.selectedOptions).map(o => o.value) : e.target.value;
    setVal(v);
    onChange && onChange(v, e);
  };

  return (
    <div className="relative">
      <select id={id} value={val} onChange={handleChange} disabled={disabled} multiple={multiple}
        className={cx(baseInput(size, status), 'appearance-none pr-10', className)}>
        {!multiple && <option value="">{placeholder}</option>}
        {options.map((o, i) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o.value ?? o}</option>)}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</div>
    </div>
  );
};

/* SearchableSelect */
export const SearchableSelect = ({ id, value, defaultValue, onChange, options = [], placeholder = 'Type to search...', className = '' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);
  const ref = useRef();

  const filtered = options.filter(o => (o.label ?? String(o)).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const select = (v) => { setVal(v); onChange && onChange(v); setOpen(false); setQuery(''); };

  return (
    <div ref={ref} className="relative">
      <motion.input value={query || val} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder}
        className={cx(baseInput('md'), 'pr-10', className)} />

      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: open ? 1 : 0, y: open ? 0 : -6 }} className={cx('absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg z-50 overflow-hidden', !open && 'pointer-events-none opacity-0')}>
        <div className="max-h-48 overflow-auto">
          {(filtered.length === 0) ? <div className="p-3 text-sm text-slate-500">No matches</div> : filtered.map((o, i) => (
            <button key={i} onClick={() => select(o.value ?? o.label ?? o)} className="w-full text-left px-4 py-2 hover:bg-slate-50">{o.label ?? o.value ?? o}</button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

/* RadioGroup */
export const RadioGroup = ({ name, value, onChange, options = [], inline = false, size='md' }) => {
  const [val, setVal] = useState(value ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);
  const handle = (v) => { setVal(v); onChange && onChange(v); };

  return (
    <div className={cx(inline ? 'flex gap-2' : 'flex flex-col gap-2')}>
      {options.map((o) => {
        const v = o.value ?? o;
        const active = val === v;
        return (
          <button key={v} type="button" onClick={() => handle(v)} className={cx('inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition', active ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-white hover:bg-slate-50')}>
            <span className={cx('w-3 h-3 rounded-full', active ? 'bg-sky-500' : 'bg-slate-300')}></span>
            <span className="text-sm">{o.label ?? o}</span>
          </button>
        );
      })}
    </div>
  );
};

/* Checkbox */
export const Checkbox = ({ checked, defaultChecked, onChange, label, id, className = '' }) => {
  const [val, setVal] = useState(checked ?? defaultChecked ?? false);
  useEffect(() => { if (checked !== undefined) setVal(checked); }, [checked]);
  const toggle = (v) => { setVal(v); onChange && onChange(v); };

  return (
    <label className={cx('inline-flex items-center gap-3 cursor-pointer select-none', className)}>
      <span className={cx('inline-flex items-center justify-center w-5 h-5 rounded-md transition', val ? 'bg-sky-500' : 'bg-white border border-slate-200')}>
        {val && <svg width="14" height="14" viewBox="0 0 24 24" className="text-white"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
};

/* ToggleSwitch */
export const ToggleSwitch = ({ checked, defaultChecked, onChange, id, className = '' }) => {
  const [val, setVal] = useState(checked ?? defaultChecked ?? false);
  useEffect(() => { if (checked !== undefined) setVal(checked); }, [checked]);
  const toggle = () => { const n = !val; setVal(n); onChange && onChange(n); };

  return (
    <button id={id} role="switch" aria-checked={val} onClick={toggle} className={cx('relative inline-flex items-center h-7 w-12 rounded-full transition focus:outline-none', val ? 'bg-gradient-to-r from-sky-500 to-cyan-500 shadow-lg' : 'bg-slate-200', className)}>
      <motion.span layout className={cx('block w-5 h-5 bg-white rounded-full shadow transform')} style={{ marginLeft: val ? 22 : 4 }} />
    </button>
  );
};

/* DateInput */
export const DateInput = ({ id, value, defaultValue, onChange, className = '' }) => {
  const [val, setVal] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setVal(value); }, [value]);
  const handle = (e) => { setVal(e.target.value); onChange && onChange(e.target.value, e); };
  return <input id={id} type="date" value={val} onChange={handle} className={cx(baseInput('md'), className)} />;
};

/* -------------------- FileInput (drag & drop + styled) -------------------- */
/*
  Key fixes applied here to prevent modal from closing when native file dialog opens:
   - stopPropagation on the visible 'browse' button (onClick + onMouseDown)
   - stopPropagation on the hidden <input> (onClick + onMouseDown)
   - wrapper div handlers defensively stop propagation for click/mousedown
   - existing drag handlers still work (we call preventDefault() and stopPropagation() inside handle)
*/
export const FileInput = ({ id, onChange, accept='*', multiple=false, className = '', buttonLabel = 'Choose file' }) => {
  const ref = useRef();
  const [drag, setDrag] = useState(false);

  // central handler: stops propagation + delegates files
  const handle = (e) => {
    // prevent accidental bubbling to backdrop/modal
    try { e && e.preventDefault(); } catch (err) {}
    try { e && e.stopPropagation(); } catch (err) {}
    const files = (e && (e.target?.files || e.dataTransfer?.files)) || [];
    onChange && onChange(files, e);
  };

  const onDrop = (e) => { setDrag(false); handle(e); };

  // defensive wrapper function used by the visible 'browse' button
  const openFileDialog = (e) => {
    e && e.stopPropagation();
    // some browsers require mousedown/mouseup ordering; we also prevent default on mousedown via handler below
    if (ref.current && typeof ref.current.click === 'function') ref.current.click();
  };

  return (
    // wrapper: stop propagation of clicks/mousedown that could bubble to the modal backdrop
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setDrag(false); }}
      onDrop={onDrop}
      className={cx('rounded-lg border-dashed p-4 text-center transition', drag ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white', className)}
    >
      {/* hidden input: defensive stopPropagation on click/mousedown */}
      <input
        id={id}
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handle}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />

      <div className="flex flex-col items-center gap-2">
        <svg width="28" height="28" viewBox="0 0 24 24" className="text-slate-400"><path d="M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>

        {/* visible browse button: stop propagation on both mousedown and click before invoking hidden input */}
        <div className="text-sm">
          Drag & drop files here, or{' '}
          <button
            type="button"
            onMouseDown={(e) => { e && e.stopPropagation && e.stopPropagation(); }}
            onClick={openFileDialog}
            className="text-sky-500 underline"
          >
            browse
          </button>
        </div>

        <div className="text-xs text-slate-400">{multiple ? 'Multiple files allowed' : 'Single file'}</div>
      </div>
    </div>
  );
};

/* IconInput & ClearableInput */
export const IconInput = ({ id, icon: Icon, ...props }) => <TextInput id={id} icon={Icon} {...props} />;
export const ClearableInput = (props) => <TextInput clearable {...props} />;

/* InputGroup */
export const InputGroup = ({ children, prepend, append, className = '' }) => (
  <div className={cx('flex items-stretch gap-2', className)}>
    {prepend && <div className="inline-flex items-center px-3 rounded-l-lg bg-slate-50 border border-r-0 border-slate-200">{prepend}</div>}
    <div className="flex-1">{children}</div>
    {append && <div className="inline-flex items-center px-3 rounded-r-lg bg-slate-50 border border-l-0 border-slate-200">{append}</div>}
  </div>
);

/* Playground (demo) - unchanged (keeps exported default) */
export default function InputsPlayground() {
  const [t, setT] = useState('');
  const [num, setNum] = useState(10);
  const [sel, setSel] = useState('user');
  const [multi, setMulti] = useState('');
  const [toggle, setToggle] = useState(false);

  return (
    <div className="p-8 bg-gradient-to-b from-slate-50 to-white min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold">Inputs — Shreeja ERP</h2>
        <p className="text-slate-500">Polished inputs with subtle motion and elevated styles. Copy/paste into your project.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField id="name" label="Full name" help="As on official documents" required>
              <TextInput id="name" value={t} onChange={setT} placeholder="e.g. Rajesh Kumar" clearable />
            </FormField>

            <FormField id="email" label="Email address" help="We'll send account updates">
              <InputGroup prepend={<span className="text-slate-500">📧</span>}>
                <TextInput id="email" placeholder="name@company.com" />
              </InputGroup>
            </FormField>

            <FormField id="age" label="Age">
              <NumberInput id="age" value={num} onChange={setNum} min={0} max={120} />
            </FormField>

            <FormField id="bio" label="Short bio">
              <TextArea id="bio" placeholder="A short, punchy bio" />
            </FormField>

            <FormField id="role" label="Role">
              <Select id="role" options={[{value:'admin',label:'Admin'},{value:'user',label:'User'},{value:'viewer',label:'Viewer'}]} value={sel} onChange={setSel} />
            </FormField>
          </div>

          <div className="space-y-4">
            <FormField id="search" label="Search & pick">
              <SearchableSelect id="search" options={[{value:'one',label:'One'},{value:'two',label:'Two'},{value:'three',label:'Three'},{value:'four',label:'Four'}]} value={multi} onChange={setMulti} />
            </FormField>

            <FormField label="Preferences">
              <RadioGroup name="freq" options={[{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'},{value:'monthly',label:'Monthly'}]} inline />
              <div className="mt-4"><Checkbox label="Subscribe to newsletter" /></div>
              <div className="mt-4"><ToggleSwitch checked={toggle} onChange={setToggle} /></div>
            </FormField>

            <FormField label="Attachments">
              <FileInput onChange={(files) => alert(files && files.length ? files[0].name : 'no file')} />
            </FormField>

            <FormField label="Quick actions">
              <div className="flex gap-2">
                <ClearableInput placeholder="Search..." />
                <TextInput placeholder="Small" size="sm" />
              </div>
            </FormField>
          </div>
        </div>

      </div>
    </div>
  );
}
