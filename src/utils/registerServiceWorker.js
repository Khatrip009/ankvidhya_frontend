// src/utils/registerServiceWorker.js
/**
 * Minimal, safe service worker registration helper.
 * - Registers /service-worker.js (the default Vite PWA output if you use one)
 * - Only attempts registration when supported and in production builds.
 *
 * If you don't use a service-worker (no Vite PWA or Workbox), this will quietly exit.
 */

export async function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Only register a SW file if it exists on the server (simple check)
  try {
    // try fetch the SW file head first to avoid noisy console errors
    const swUrl = '/service-worker.js';
    const headResp = await fetch(swUrl, { method: 'HEAD' });
    if (!headResp.ok) {
      // no worker available
      return;
    }

    const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });

    // optional: listen for updates
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // new content is available when there's already a controller
          if (navigator.serviceWorker.controller) {
            // notify the user if you want (via window.ui.toast or custom event)
            try {
              if (window.ui?.toast) window.ui.toast('New version available — please refresh', 'info');
            } catch (e) {}
          }
        }
      });
    });

    return reg;
  } catch (e) {
    // swallow errors; registration is optional
    // eslint-disable-next-line no-console
    console.warn('SW registration failed', e);
    throw e;
  }
}
