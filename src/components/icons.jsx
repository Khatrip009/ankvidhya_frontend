/*
  icons.jsx
  Large ERP icon library for Shreeja ERP
  - Exports a single object `ERPIcons` containing many lightweight SVG React components
  - Icons are minimal, stroke-based, scalable, and use `currentColor` so they inherit color

  Notes on fixes in this version:
  - `makeIcon` now returns the icon <svg> with `children` inserted directly (no Fragment wrapper).
    Children are passed through React.Children.toArray() to normalize arrays, strings, and elements
    into a valid children list for React.
  - `makeIcon` also sets a helpful displayName when possible.
  - Keep API backward-compatible (default export ERPIcons + named exports).

  This version avoids adjacent-JSX and invalid-element errors by ensuring the children passed to
  the svg are normalized into a proper array of valid React nodes.
*/

import React from 'react';

// Helper: accepts either a React node (JSX) or a function that returns JSX.
// Returns a React component for the icon.
const makeIcon = (name, pathChildren) => {
  const Icon = (props) => {
    const children = (typeof pathChildren === 'function') ? pathChildren(props) : pathChildren;
    // Normalize children into a valid React children array (handles single elements, arrays, strings)
    const normalized = React.Children.toArray(children);
    return (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {normalized}
      </svg>
    );
  };
  Icon.displayName = name ? `${name}Icon` : 'ERPIcon';
  return Icon;
};

// --- ICONS ---
export const ERPIcons = {
  Dashboard: makeIcon('Dashboard', () => <path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM13 3v6h8V3h-8zM3 21h8v-6H3v6z" />),
  Analytics: makeIcon('Analytics', () => [<path key="a1" d="M3 3v18h18" />, <path key="a2" d="M7 14v-4" />, <path key="a3" d="M12 17v-8" />, <path key="a4" d="M17 11V7" />]),
  Reports: makeIcon('Reports', () => [<path key="r1" d="M21 15V7a2 2 0 0 0-2-2H9L3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />, <path key="r2" d="M7 10h10" />, <path key="r3" d="M7 14h6" />]),
  Settings: makeIcon('Settings', () => [
    <path key="s1" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />,
    <path key="s2" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 2.28 17.3l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.66 0 1.26-.38 1.51-1a1.65 1.65 0 0 0-.33-1.82L4.3 6.28A2 2 0 1 1 7.13 3.45l.06.06c.46.39 1.07.57 1.68.45.54-.11 1.06-.42 1.42-.86A2 2 0 1 1 13 4.09v.09c0 .66.38 1.26 1 1.51.61.12 1.22-.06 1.68-.45l.06-.06A2 2 0 1 1 19.72 6.7l-.06.06c-.39.46-.57 1.07-.45 1.68.25.62.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.38-1.51 1z" />
  ]),
  Users: makeIcon('Users', () => [<path key="u1" d="M17 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />, <circle key="u2" cx="12" cy="7" r="4" />]),
  UserAdd: makeIcon('UserAdd', () => [<path key="ua1" d="M16 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />, <circle key="ua2" cx="12" cy="7" r="4" />, <path key="ua3" d="M20 8v6" />, <path key="ua4" d="M23 11h-6" />]),
  Team: makeIcon('Team', () => [<path key="t1" d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" />, <path key="t2" d="M2 20v-2c0-2 4-3 7-3s7 1 7 3v2" />, <path key="t3" d="M22 20v-2c0-2-4-3-7-3s-7 1-7 3v2" />]),
  Product: makeIcon('Product', () => [<rect key="p1" x="3" y="3" width="18" height="18" rx="2" />, <path key="p2" d="M3 7h18" />]),
  Inventory: makeIcon('Inventory', () => [<path key="i1" d="M21 16V8a2 2 0 0 0-1-1.73L13 3.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />, <path key="i2" d="M12 7v10" />]),
  Cart: makeIcon('Cart', () => [<path key="c1" d="M6 6h15l-1.5 9h-12z" />, <circle key="c2" cx="9" cy="20" r="1" />, <circle key="c3" cx="18" cy="20" r="1" />]),
  Order: makeIcon('Order', () => [<path key="o1" d="M3 3h18v4H3z" />, <path key="o2" d="M7 13h10" />, <path key="o3" d="M7 17h7" />]),
  Invoice: makeIcon('Invoice', () => [<rect key="in1" x="3" y="3" width="18" height="18" rx="2" />, <path key="in2" d="M7 7h10" />, <path key="in3" d="M7 11h10" />, <path key="in4" d="M7 15h6" />]),
  Receipt: makeIcon('Receipt', () => [<path key="rc1" d="M21 10V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5" />, <path key="rc2" d="M7 14h10" />, <path key="rc3" d="M7 18h6" />]),
  Payment: makeIcon('Payment', () => [<rect key="pm1" x="2" y="7" width="20" height="14" rx="2" />, <path key="pm2" d="M2 11h20" />, <circle key="pm3" cx="6" cy="14" r="1" />]),
  CreditCard: makeIcon('CreditCard', () => [<rect key="cc1" x="2" y="4" width="20" height="16" rx="2" />, <path key="cc2" d="M2 10h20" />]),
  Bank: makeIcon('Bank', () => [<path key="b1" d="M12 2l10 6v2H2V8z" />, <path key="b2" d="M3 10l9 6 9-6" />, <path key="b3" d="M4 22h16" />]),
  Wallet: makeIcon('Wallet', () => [<rect key="w1" x="2" y="7" width="20" height="14" rx="2" />, <path key="w2" d="M16 12a2 2 0 1 1 0 4" />]),
  CalendarCheck: makeIcon('CalendarCheck', () => [<rect key="cck1" x="3" y="4" width="18" height="18" rx="2" />, <path key="cck2" d="M8 2v4" />, <path key="cck3" d="M16 2v4" />, <path key="cck4" d="M9 12l2 2 4-4" />]),
  CalendarPlus: makeIcon('CalendarPlus', () => [<rect key="cpl1" x="3" y="4" width="18" height="18" rx="2" />, <path key="cpl2" d="M8 2v4" />, <path key="cpl3" d="M16 2v4" />, <path key="cpl4" d="M12 10v6" />, <path key="cpl5" d="M9 13h6" />]),
  Clock: makeIcon('Clock', () => [<circle key="cl1" cx="12" cy="12" r="10" />, <path key="cl2" d="M12 6v6l4 2" />]),
  Notification: makeIcon('Notification', () => [<path key="n1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />, <path key="n2" d="M13.73 21a2 2 0 0 1-3.46 0" />]),
  Bell: makeIcon('Bell', () => [<path key="be1" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />, <path key="be2" d="M13.73 21a2 2 0 0 1-3.46 0" />]),
  Message: makeIcon('Message', () => <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  Chat: makeIcon('Chat', () => [<path key="ch1" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, <path key="ch2" d="M7 10h10" />]),
  File: makeIcon('File', () => <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2h8a2 2 0 0 0 2-2V8z" />),
  Folder: makeIcon('Folder', () => <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  FolderOpen: makeIcon('FolderOpen', () => [<path key="fo1" d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />, <path key="fo2" d="M21 15v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />]),
  UploadCloud: makeIcon('UploadCloud', () => [<path key="uc1" d="M16 16l-4-4-4 4" />, <path key="uc2" d="M12 12v8" />, <path key="uc3" d="M20.39 18.39A5 5 0 0 0 18 9h-1.26" />]),
  DownloadCloud: makeIcon('DownloadCloud', () => [<path key="dc1" d="M12 12l4 4H8l4-4" />, <path key="dc2" d="M12 12V4" />, <path key="dc3" d="M20.39 18.39A5 5 0 0 1 18 9h-1.26" />]),
  Cloud: makeIcon('Cloud', () => <path d="M20 17.58A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 4 16" />),
  Sync: makeIcon('Sync', () => [<path key="sy1" d="M21 12a9 9 0 1 1-3-6.71" />, <polyline key="sy2" points="23 7 23 1 17 1" />, <polyline key="sy3" points="1 17 1 23 7 23" />]),
  Refresh: makeIcon('Refresh', () => [<path key="rf1" d="M20 4v6h-6" />, <path key="rf2" d="M4 20v-6h6" />, <path key="rf3" d="M20 4a8 8 0 0 0-16 0" />, <path key="rf4" d="M4 20a8 8 0 0 0 16 0" />]),
  Search: makeIcon('Search', () => [<circle key="s1" cx="11" cy="11" r="7" />, <line key="s2" x1="21" y1="21" x2="16.65" y2="16.65" />]),
  Filter: makeIcon('Filter', () => <path d="M22 3H2l8 9v7l4 2v-9z" />),
  SortAsc: makeIcon('SortAsc', () => [<path key="sa1" d="M12 19V5" />, <path key="sa2" d="M5 12l7-7 7 7" />]),
  Plus: makeIcon('Plus', () => [<line key="p1" x1="12" y1="5" x2="12" y2="19" />, <line key="p2" x1="5" y1="12" x2="19" y2="12" />]),
  Minus: makeIcon('Minus', () => <line x1="5" y1="12" x2="19" y2="12" />),
  Edit: makeIcon('Edit', () => [<path key="e1" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />, <path key="e2" d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />]),
  Save: makeIcon('Save', () => [<path key="sv1" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />, <polyline key="sv2" points="17 21 17 13 7 13 7 21" />]),
  Archive: makeIcon('Archive', () => [<rect key="ar1" x="3" y="3" width="18" height="4" rx="1" />, <path key="ar2" d="M21 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" />, <path key="ar3" d="M10 11h4" />]),
  Delete: makeIcon('Delete', () => [<path key="dl1" d="M21 4H8l-1 1H4v2h16V5z" />, <path key="dl2" d="M10 11v6" />, <path key="dl3" d="M14 11v6" />]),
  Trash: makeIcon('Trash', () => [<polyline key="tr1" points="3 6 5 6 21 6" />, <path key="tr2" d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />, <path key="tr3" d="M10 11v6" />, <path key="tr4" d="M14 11v6" />]),
  Lock: makeIcon('Lock', () => [<rect key="lk1" x="3" y="11" width="18" height="11" rx="2" />, <path key="lk2" d="M7 11V7a5 5 0 0 1 10 0v4" />]),
  Unlock: makeIcon('Unlock', () => [<rect key="ul1" x="3" y="11" width="18" height="11" rx="2" />, <path key="ul2" d="M7 11V7a5 5 0 0 1 10 0" />, <path key="ul3" d="M12 17v.01" />]),
  Shield: makeIcon('Shield', () => <path d="M12 2l7 4v6c0 6-4 10-7 12-3-2-7-6-7-12V6l7-4z" />),
  Key: makeIcon('Key', () => [<circle key="k1" cx="7" cy="14" r="3" />, <path key="k2" d="M10 14l10-10" />, <path key="k3" d="M18 6v2" />]),
  Tag: makeIcon('Tag', () => [<path key="tg1" d="M20 10V6a2 2 0 0 0-2-2h-4L2 12v6a2 2 0 0 0 2 2h4l10-10z" />, <circle key="tg2" cx="7" cy="7" r="1.5" />]),
  Label: makeIcon('Label', () => [<rect key="lb1" x="3" y="7" width="14" height="10" rx="2" />, <path key="lb2" d="M7 11h6" />]),
  Barcode: makeIcon('Barcode', () => [<rect key="bc1" x="2" y="4" width="20" height="16" rx="2" />, <path key="bc2" d="M7 8v8" />, <path key="bc3" d="M10 8v8" />, <path key="bc4" d="M13 8v8" />, <path key="bc5" d="M16 8v8" />]),
  QR: makeIcon('QR', () => [<rect key="qr1" x="3" y="3" width="8" height="8" />, <rect key="qr2" x="13" y="3" width="8" height="8" />, <rect key="qr3" x="3" y="13" width="8" height="8" />, <rect key="qr4" x="13" y="13" width="4" height="4" />]),
  Map: makeIcon('Map', () => <path d="M3 6l7-3 7 3 7-3v14l-7 3-7-3-7 3V6z" />),
  Location: makeIcon('Location', () => [<path key="lo1" d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />, <circle key="lo2" cx="12" cy="10" r="3" />]),
  Pin: makeIcon('Pin', () => [<path key="pn1" d="M12 2C8 2 5 5 5 9c0 7 7 13 7 13s7-6 7-13c0-4-3-7-7-7z" />, <circle key="pn2" cx="12" cy="9" r="2" />]),
  Home: makeIcon('Home', () => <path d="M3 11L12 3l9 8v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8z" />),
  Help: makeIcon('Help', () => [<circle key="hp1" cx="12" cy="12" r="10" />, <path key="hp2" d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" />, <path key="hp3" d="M12 17h.01" />]),
  InfoCircle: makeIcon('InfoCircle', () => [<circle key="ic1" cx="12" cy="12" r="10" />, <path key="ic2" d="M12 16v-4" />, <path key="ic3" d="M12 8h.01" />]),
  Star: makeIcon('Star', () => <path d="M12 17.27L18.18 21l-1.64-7L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24 7.46 14l-1.64 7z" />),
  Favorite: makeIcon('Favorite', () => <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />),
  Eye: makeIcon('Eye', () => [<path key="ey1" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />, <circle key="ey2" cx="12" cy="12" r="3" />]),
  EyeOff: makeIcon('EyeOff', () => [<path key="eo1" d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.12 21.12 0 0 1 5.06-7.94" />, <path key="eo2" d="M1 1l22 22" />, <path key="eo3" d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />]),
  ChartLine: makeIcon('ChartLine', () => [<path key="cl1" d="M3 3v18h18" />, <path key="cl2" d="M6 14l4-4 4 6 6-8" />]),
  ChartBar: makeIcon('ChartBar', () => [<path key="cb1" d="M3 3v18h18" />, <rect key="cb2" x="7" y="10" width="3" height="7" />, <rect key="cb3" x="12" y="6" width="3" height="11" />, <rect key="cb4" x="17" y="13" width="3" height="4" />]),
  PieChart: makeIcon('PieChart', () => [<path key="pc1" d="M21.21 15a9 9 0 1 0-9.21 6.99" />, <path key="pc2" d="M21 12h-9V3" />]),
  Grid: makeIcon('Grid', () => [<rect key="g1" x="3" y="3" width="18" height="18" rx="2" />, <path key="g2" d="M9 3v18" />, <path key="g3" d="M15 3v18" />, <path key="g4" d="M3 9h18" />, <path key="g5" d="M3 15h18" />]),
  Table: makeIcon('Table', () => [<rect key="tb1" x="3" y="3" width="18" height="18" rx="2" />, <path key="tb2" d="M3 9h18" />, <path key="tb3" d="M9 3v18" />]),
  Columns: makeIcon('Columns', () => [<rect key="co1" x="3" y="3" width="6" height="18" rx="1" />, <rect key="co2" x="10" y="3" width="4" height="18" rx="1" />, <rect key="co3" x="16" y="3" width="5" height="18" rx="1" />]),
  Rows: makeIcon('Rows', () => [<rect key="rw1" x="3" y="4" width="18" height="4" rx="1" />, <rect key="rw2" x="3" y="10" width="18" height="4" rx="1" />, <rect key="rw3" x="3" y="16" width="18" height="4" rx="1" />]),
  Link: makeIcon('Link', () => [<path key="lk1" d="M10 13a5 5 0 0 0 7 0l3-3" />, <path key="lk2" d="M14 11a5 5 0 0 0-7 0L4 14" />]),
  Bolt: makeIcon('Bolt', () => <path d="M13 2L3 14h7l-1 8 10-12h-7z" />),
  Play: makeIcon('Play', () => <polygon points="5 3 19 12 5 21 5 3" />),
  Pause: makeIcon('Pause', () => [<rect key="pa1" x="6" y="4" width="4" height="16" />, <rect key="pa2" x="14" y="4" width="4" height="16" />]),
  Stop: makeIcon('Stop', () => <rect x="6" y="6" width="12" height="12" />),
  Gear: makeIcon('Gear', () => <path d="M20.59 13.41l1.41-1.41-2.83-2.83 1.41-1.41-1.41-1.41-1.41 1.41-2.83-2.83-1.41 1.41 2.83 2.83-1.41 1.41 1.41 1.41 1.41-1.41 2.83 2.83z" />),
  Code: makeIcon('Code', () => [<polyline key="cd1" points="16 18 22 12 16 6" />, <polyline key="cd2" points="8 6 2 12 8 18" />]),
  Terminal: makeIcon('Terminal', () => [<path key="tm1" d="M4 6h16" />, <path key="tm2" d="M4 12l6 6" />, <path key="tm3" d="M10 6l-6 6" />]),
  Api: makeIcon('Api', () => [<path key="ap1" d="M12 2v4" />, <path key="ap2" d="M12 18v4" />, <path key="ap3" d="M4 8h16" />, <path key="ap4" d="M4 16h16" />]),
  Robot: makeIcon('Robot', () => [<rect key="rb1" x="7" y="3" width="10" height="4" rx="1" />, <rect key="rb2" x="4" y="7" width="16" height="12" rx="2" />, <circle key="rb3" cx="9" cy="12" r="1" />, <circle key="rb4" cx="15" cy="12" r="1" />, <path key="rb5" d="M8 21v2" />, <path key="rb6" d="M16 21v2" />]),
  Palette: makeIcon('Palette', () => <path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3 3 3 3 0 1 1-3-3 9 9 0 0 0 0-18z" />),
  Paint: makeIcon('Paint', () => [<path key="pt1" d="M2 22s4-4 6-4 4 4 8 0" />, <path key="pt2" d="M20 12l-6 6" />, <path key="pt3" d="M14 6l6 6" />]),
  Printer: makeIcon('Printer', () => [<rect key="pr1" x="6" y="3" width="12" height="6" rx="2" />, <rect key="pr2" x="6" y="11" width="12" height="10" rx="2" />, <path key="pr3" d="M9 14h6" />]),
  Undo: makeIcon('Undo', () => [<path key="un1" d="M9 21V12H4" />, <path key="un2" d="M20 7l-7-4v8" />]),
  Redo: makeIcon('Redo', () => [<path key="rd1" d="M15 3v9h5" />, <path key="rd2" d="M4 12l7 4V8" />]),
  Duplicate: makeIcon('Duplicate', () => [<rect key="dp1" x="9" y="9" width="13" height="13" rx="2" />, <rect key="dp2" x="2" y="2" width="13" height="13" rx="2" />]),
  Copy: makeIcon('Copy', () => [<rect key="cp1" x="9" y="9" width="13" height="13" rx="2" />, <rect key="cp2" x="2" y="2" width="13" height="13" rx="2" />]),
  Paste: makeIcon('Paste', () => [<rect key="ps1" x="9" y="2" width="13" height="4" rx="1" />, <rect key="ps2" x="9" y="8" width="13" height="14" rx="2" />, <path key="ps3" d="M5 8v14" />]),
  Clipboard: makeIcon('Clipboard', () => [<path key="cbp1" d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z" />, <rect key="cbp2" x="3" y="6" width="18" height="16" rx="2" />]),
  CheckCircle: makeIcon('CheckCircle', () => [<circle key="cc1" cx="12" cy="12" r="10" />, <path key="cc2" d="M9 12l2 2 4-4" />]),
  XCircle: makeIcon('XCircle', () => [<circle key="xc1" cx="12" cy="12" r="10" />, <path key="xc2" d="M15 9l-6 6" />, <path key="xc3" d="M9 9l6 6" />]),
  Alert: makeIcon('Alert', () => [<path key="al1" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />, <path key="al2" d="M12 9v4" />, <path key="al3" d="M12 17h.01" />]),
  Megaphone: makeIcon('Megaphone', () => [<path key="mg1" d="M3 11v2a2 2 0 0 0 2 2h1l6 3V6L6 9H5a2 2 0 0 0-2 2z" />, <path key="mg2" d="M21 8v8" />]),
  Badge: makeIcon('Badge', () => <path d="M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7L2 10l7-1 3-7z" />),
  Ribbon: makeIcon('Ribbon', () => [<path key="rbn1" d="M6 2h12l-3 9H9L6 2z" />, <path key="rbn2" d="M6 11v11l6-4 6 4V11" />]),
  Crown: makeIcon('Crown', () => <path d="M2 22l4-8 4 4 4-10 4 10 4-4 0 8z" />),
  Trophy: makeIcon('Trophy', () => <path d="M8 2h8v3a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1a6 6 0 0 1-10 0H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4V2z" />),
  Medal: makeIcon('Medal', () => [<circle key="md1" cx="12" cy="8" r="6" />, <path key="md2" d="M8 14l-2 6 6-3 6 3-2-6" />]),
  Gift: makeIcon('Gift', () => [<rect key="gf1" x="2" y="7" width="20" height="14" rx="2" />, <path key="gf2" d="M12 7v14" />, <path key="gf3" d="M2 13h20" />]),
  Calculator: makeIcon('Calculator', () => [<rect key="cal1" x="3" y="2" width="18" height="20" rx="2" />, <path key="cal2" d="M7 6h10" />, <path key="cal3" d="M7 10h10" />, <path key="cal4" d="M7 14h2" />, <path key="cal5" d="M11 14h2" />, <path key="cal6" d="M15 14h2" />]),
  Percent: makeIcon('Percent', () => [<circle key="pc1" cx="7" cy="7" r="2" />, <circle key="pc2" cx="17" cy="17" r="2" />, <path key="pc3" d="M19 5L5 19" />]),
  Receipt2: makeIcon('Receipt2', () => [<path key="r21" d="M21 10V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5" />, <path key="r22" d="M7 14h10" />, <path key="r23" d="M7 18h6" />]),
  Banknote: makeIcon('Banknote', () => [<rect key="bn1" x="2" y="5" width="20" height="14" rx="2" />, <circle key="bn2" cx="12" cy="12" r="3" />]),
  Truck: makeIcon('Truck', () => [<path key="trc1" d="M1 3h15v13H1z" />, <path key="trc2" d="M23 8v8h-4v-6h-4" />, <circle key="trc3" cx="5.5" cy="18.5" r="1.5" />, <circle key="trc4" cx="18.5" cy="18.5" r="1.5" />]),
  Shipping: makeIcon('Shipping', () => [<path key="sp1" d="M3 3h18v13H3z" />, <path key="sp2" d="M16 3v13" />, <path key="sp3" d="M7 21h10" />]),
  MapPin: makeIcon('MapPin', () => [<path key="mp1" d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />, <circle key="mp2" cx="12" cy="10" r="2.5" />]),
  Globe: makeIcon('Globe', () => [<circle key="gl1" cx="12" cy="12" r="10" />, <path key="gl2" d="M2 12h20" />, <path key="gl3" d="M12 2a15 15 0 0 0 0 20" />]),
  Language: makeIcon('Language', () => [<path key="lg1" d="M2 12h20" />, <path key="lg2" d="M12 2a15 15 0 0 0 0 20" />, <path key="lg3" d="M6 6l12 12" />]),
  Translate: makeIcon('Translate', () => [<path key="tr1" d="M12 3v4" />, <path key="tr2" d="M6 7h12" />, <path key="tr3" d="M4 21h16" />, <path key="tr4" d="M12 17l-4-8" />]),
  Login: makeIcon('Login', () => [<path key="lg1" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />, <path key="lg2" d="M10 17l5-5-5-5" />, <path key="lg3" d="M15 12H3" />]),
  Logout: makeIcon('Logout', () => [<path key="lo1" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />, <path key="lo2" d="M16 17l5-5-5-5" />, <path key="lo3" d="M21 12H9" />]),
  Power: makeIcon('Power', () => [<path key="pw1" d="M18 7a7 7 0 1 1-12 0" />, <path key="pw2" d="M12 2v10" />]),
  Menu: makeIcon('Menu', () => [<path key="mn1" d="M3 6h18" />, <path key="mn2" d="M3 12h18" />, <path key="mn3" d="M3 18h18" />]),
  Close: makeIcon('Close', () => [<line key="cl1" x1="18" y1="6" x2="6" y2="18" />, <line key="cl2" x1="6" y1="6" x2="18" y2="18" />]),
  Profile: makeIcon('Profile', () => [<path key="pf1" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />, <circle key="pf2" cx="12" cy="7" r="4" />]),
  HeaderLogo: makeIcon('HeaderLogo', () => [<circle key="hl1" cx="12" cy="12" r="10" />, <path key="hl2" d="M12 8v8" />, <path key="hl3" d="M8 12h8" />]),
  ChevronRight: makeIcon('ChevronRight', () => <polyline points="9 6 15 12 9 18" />),
  ChevronLeft: makeIcon('ChevronLeft', () => <polyline points="15 6 9 12 15 18" />),
  ChevronDown: makeIcon('ChevronDown', () => <polyline points="6 9 12 15 18 9" />),
  ChevronUp: makeIcon('ChevronUp', () => <polyline points="6 15 12 9 18 15" />),
  DotsVertical: makeIcon('DotsVertical', () => [<circle key="dv1" cx="12" cy="5" r="1" />, <circle key="dv2" cx="12" cy="12" r="1" />, <circle key="dv3" cx="12" cy="19" r="1" />]),
  DotsHorizontal: makeIcon('DotsHorizontal', () => [<circle key="dh1" cx="5" cy="12" r="1" />, <circle key="dh2" cx="12" cy="12" r="1" />, <circle key="dh3" cx="19" cy="12" r="1" />]),
  Heart: makeIcon('Heart', () => <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />),
  Puzzle: makeIcon('Puzzle', () => [<path key="pz1" d="M15 3h4v4" />, <path key="pz2" d="M3 9v6h6v6h6v-6h6V9H9V3H3v6z" />]),
};

// Export named icons for convenience (keeps previous API)
export const {
  Dashboard, Analytics, Reports, Settings, Users, UserAdd, Team, Product, Inventory,
  Cart, Order, Invoice, Receipt, Payment, CreditCard, Bank, Wallet, CalendarCheck, CalendarPlus,
  Clock, Notification, Bell, Message, Chat, File, Folder, FolderOpen, UploadCloud, DownloadCloud, Cloud,
  Sync, Refresh, Search, Filter, SortAsc, Plus, Minus, Edit, Save, Archive, Delete, Trash, Lock, Unlock,
  Shield, Key, Tag, Label, Barcode, QR, Map, Location, Pin, Home, Help, InfoCircle, Star, Favorite, Eye, EyeOff,
  ChartLine, ChartBar, PieChart, Grid, Table, Columns, Rows, Link, Bolt, Play, Pause, Stop, Gear, Code, Terminal,
  Api, Robot, Palette, Paint, Printer, Undo, Redo, Duplicate, Copy, Paste, Clipboard, CheckCircle, XCircle, Alert,
  Megaphone, Badge, Ribbon, Crown, Trophy, Medal, Gift, Calculator, Percent, Receipt2, Banknote, Truck, Shipping,
  MapPin, Globe, Language, Translate, Login, Logout, Power, Menu, Close, Profile, HeaderLogo, ChevronRight, ChevronLeft,
  ChevronDown, ChevronUp, DotsVertical, DotsHorizontal, Heart, Puzzle
} = ERPIcons;

export default ERPIcons;
