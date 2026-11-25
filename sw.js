var CACHE_NAME = 'khoroch-khata-v1';
var APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Never intercept Firestore, Firebase Auth APIs, or OAuth handlers
  if (
    url.hostname.indexOf('firestore.googleapis.com') !== -1 ||
    url.hostname.indexOf('identitytoolkit.googleapis.com') !== -1 ||
    url.hostname.indexOf('securetoken.googleapis.com') !== -1 ||
    url.pathname.indexOf('/__/auth/') !== -1
  ) {
    return;
  }

  // Same-origin App Shell: Network-First with Offline Cache Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || (req.mode === 'navigate' ? caches.match('/') : cached);
        });
      })
    );
    return;
  }

  // Static CDNs (Google Fonts & Firebase SDK JS): Stale-While-Revalidate
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'www.gstatic.com'
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var netFetch = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || netFetch;
      })
    );
  }
});
