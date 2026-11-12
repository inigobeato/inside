/* Inside — web.js · LIAB Digital Studio
   One file, two jobs:
   1) Service worker (offline cache) — runs when the browser loads this file as a worker.
   2) Page helper (registers the worker + "Install Inside" button) — runs when loaded with <script src="web.js">.
   Requires HTTPS (or localhost). */
const SIDEBAR_IMG = 'inside-sidebar.jpg';
const CACHE = 'inside-v2';
const FILES = ['./', 'Inside.html', 'index.html', 'web.js', 'inside.webmanifest', 'icon-192.png', 'icon-512.png', SIDEBAR_IMG];

if (typeof document === 'undefined') {
  /* ---------- Service worker ---------- */
  self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting()));
  });
  self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
  });
  self.addEventListener('fetch', e => {
    const r = e.request;
    if (r.method !== 'GET' || !r.url.startsWith('http')) return;
    // Pages: network first (always fresh), fall back to cache when offline
    if (r.mode === 'navigate') {
      e.respondWith(fetch(r).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res;
      }).catch(() => caches.match(r).then(h => h || caches.match('Inside.html'))));
      return;
    }
    // Everything else (incl. Google Fonts): cache first, update in background
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  });
} else {
  /* ---------- Page ---------- */
  if (!window.INSIDE_BANNER) window.INSIDE_BANNER = SIDEBAR_IMG;

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('web.js').catch(() => {}));
  }

  // Install button (Chrome / Edge / Android)
  let deferred;
  const pill = (id, html, onclick) => {
    if (document.getElementById(id)) return;
    const b = document.createElement('button');
    b.id = id; b.innerHTML = html; b.onclick = onclick;
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;padding:12px 18px;border:0;border-radius:14px;font:600 15px Inter,system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,var(--acc,#8a1c33),var(--acc2,#c24a63));box-shadow:0 10px 30px -8px var(--acc,#8a1c33);cursor:pointer';
    document.body.appendChild(b);
  };
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    pill('ins-btn', '⬇ Install Inside', async () => {
      deferred.prompt(); await deferred.userChoice; deferred = null;
      document.getElementById('ins-btn')?.remove();
    });
  });
  window.addEventListener('appinstalled', () => document.getElementById('ins-btn')?.remove());

  // iPhone / iPad (Safari has no install prompt)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone && !localStorage.getItem('inside_ios_tip')) {
    window.addEventListener('load', () => setTimeout(() => pill('ios-tip', 'Tap Share ⎋ → “Add to Home Screen” ✕', () => {
      localStorage.setItem('inside_ios_tip', '1'); document.getElementById('ios-tip').remove();
    }), 3000));
  }
}
