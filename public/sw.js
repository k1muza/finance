const APP_SHELL_CACHE = 'app-shell-v3'
const DATA_CACHE = 'supabase-data-v1'
const IMAGE_CACHE = 'image-cache-v1'
const IMAGE_CACHE_LIMIT = 50

// Pages are cached on first visit rather than pre-cached at install,
// because they require authentication and would fail or redirect if pre-fetched.
const APP_SHELL_URLS = []

// Never cache auth requests
function isAuthRequest(url) {
  return (
    url.includes('/auth/v1/') ||
    url.includes('/api/auth/')
  )
}

// Supabase REST data requests
function isSupabaseDataRequest(url) {
  return url.includes('.supabase.co/rest/v1/')
}

function isNextAsset(url) {
  return url.includes('/_next/')
}

// Non-Next static assets we can safely cache here.
function isStaticAsset(url) {
  return url.endsWith('.woff2') || url.endsWith('.woff')
}

function isImageRequest(request) {
  return request.destination === 'image'
}

function getPathname(urlString) {
  try {
    return new URL(urlString).pathname
  } catch {
    return null
  }
}

function isSameNavigationPath(requestUrl, responseUrl) {
  const requestPath = getPathname(requestUrl)
  const responsePath = getPathname(responseUrl)
  return Boolean(requestPath && responsePath && requestPath === responsePath)
}

function shouldCacheResponse(request, response) {
  if (!response.ok) return false
  if (request.mode !== 'navigate') return true
  return isSameNavigationPath(request.url, response.url)
}

function canServeCachedResponse(request, response) {
  if (request.mode !== 'navigate') return true
  return isSameNavigationPath(request.url, response.url)
}

// ------- Install: pre-cache app shell pages -------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_URLS).catch(() => {
        // If pre-caching fails (e.g. not authenticated yet), continue silently
      })
    )
  )
  self.skipWaiting()
})

// ------- Activate: clean up old caches -------

self.addEventListener('activate', (event) => {
  const currentCaches = [APP_SHELL_CACHE, DATA_CACHE, IMAGE_CACHE]
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// ------- Fetch: routing strategies -------

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = request.url

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Auth: always network-only, never cache
  if (isAuthRequest(url)) return

  // Let Next.js manage its own runtime and chunk assets.
  if (isNextAsset(url)) return

  // Supabase data: network-first, fall back to cache
  if (isSupabaseDataRequest(url)) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE))
    return
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE))
    return
  }

  // Images: cache-first with LRU limit
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT))
    return
  }

  // Navigation (HTML pages): network-first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(request, APP_SHELL_CACHE))
    return
  }
})

// ------- Strategy: network-first, fall back to cache -------

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (shouldCacheResponse(request, networkResponse)) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await caches.match(request)
    if (cached && canServeCachedResponse(request, cached)) return cached
    // If nothing cached and offline, return a simple offline response for navigations
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/dashboard/overview')
      if (offlinePage && isSameNavigationPath(`${self.location.origin}/dashboard/overview`, offlinePage.url)) {
        return offlinePage
      }
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// ------- Strategy: cache-first -------

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// ------- Strategy: cache-first with entry count limit -------

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
      // Evict oldest entries if over limit
      const keys = await cache.keys()
      if (keys.length > limit) {
        await cache.delete(keys[0])
      }
    }
    return networkResponse
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}
