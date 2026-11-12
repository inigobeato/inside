/* Inside — web.js · LIAB Digital Studio
   One file, two jobs:
   1) Service worker (offline cache) — runs when the browser loads this file as a worker.
   2) Page helper (registers the worker + "Install Inside" button) — runs when loaded with <script src="web.js">.
   Requires HTTPS (or localhost). */
const SIDEBAR_IMG = 'inside-sidebar.jpg';
const CACHE = 'inside-v5';
const FILES = ['./', 'Inside.html', 'index.html', 'web.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', SIDEBAR_IMG];

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
      }).catch(() => hit || Response.error());
      return hit || net;
    }));
  });
} else {
  /* ---------- Page ---------- */
  if (!window.INSIDE_BANNER) window.INSIDE_BANNER = SIDEBAR_IMG;

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('web.js', { scope: './' }).then(r => console.log('Inside: service worker ready, scope', r.scope)).catch(err => console.warn('Inside: service worker failed —', err)));
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


  // Diagnostics: open  your-site/?pwa-check  to see exactly what blocks installing
  if (/[?&]pwa-check/.test(location.search)) window.addEventListener('load', () => setTimeout(async () => {
    const out = [], ok = (t, v, d) => out.push((v ? '✅ ' : '❌ ') + t + (d ? ' — ' + d : ''));
    ok('HTTPS or localhost', isSecureContext, location.protocol + '//' + location.host);
    const link = document.querySelector('link[rel=manifest]'); ok('Manifest linked in page', !!link, link && link.href);
    let m;
    if (link) try { const r = await fetch(link.href); ok('manifest loads', r.ok, r.status + ' ' + r.headers.get('content-type')); m = await r.json(); } catch (e) { ok('manifest readable', false, e.message); }
    if (m) {
      ok('name, start_url, display', m.name && m.start_url && ['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), m.display);
      for (const ic of m.icons || []) try { const u = new URL(ic.src, link.href), r = await fetch(u), b = await createImageBitmap(await r.blob()); ok('icon ' + ic.sizes + ' ' + (ic.purpose || ''), r.ok && b.width >= 192, r.status + ' · ' + b.width + 'x' + b.height + ' · ' + r.headers.get('content-type')); } catch (e) { ok('icon ' + ic.src, false, 'cannot load/decode'); }
      try { const r = await fetch(new URL(m.start_url, link.href), { redirect: 'manual' }); ok('start_url loads without redirect', r.ok, r.status + ' ' + r.type); } catch (e) { ok('start_url', false, e.message); }
    }
    try { const g = await navigator.serviceWorker.getRegistration(); ok('Service worker registered', !!(g && g.active), g ? g.scope : 'none — check console'); } catch (e) { ok('Service worker', false, e.message); }
    ok('Install prompt fired', !!deferred, deferred ? '' : 'normal if already installed or on iOS');
    ok('Running as installed app', matchMedia('(display-mode: standalone)').matches);
    const d = document.createElement('pre');
    d.style.cssText = 'position:fixed;inset:12px;z-index:200;overflow:auto;margin:0;padding:18px;border-radius:16px;background:#000;color:#fff;border:1px solid #444;font:13px/1.7 ui-monospace,monospace;white-space:pre-wrap';
    d.textContent = 'INSIDE · INSTALL CHECK\n\n' + out.join('\n') + '\n\n' + navigator.userAgent + '\n\n(tap to close)';
    d.onclick = () => d.remove(); document.body.appendChild(d);
  }, 1500));

  // iPhone / iPad (Safari has no install prompt)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone && !localStorage.getItem('inside_ios_tip')) {
    window.addEventListener('load', () => setTimeout(() => pill('ios-tip', 'Tap Share ⎋ → “Add to Home Screen” ✕', () => {
      localStorage.setItem('inside_ios_tip', '1'); document.getElementById('ios-tip').remove();
    }), 3000));
  }
}
