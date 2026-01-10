// Service Worker for tile caching
const TILE_CACHE_NAME = 'ohub-tiles-v1'
const TILE_PATTERNS = [/^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//]

// Cache size limit (in bytes, ~50MB)
const MAX_CACHE_SIZE = 50 * 1024 * 1024

// Install event - pre-cache nothing, tiles cached on demand
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('ohub-tiles-') && name !== TILE_CACHE_NAME)
            .map((name) => caches.delete(name)),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Check if URL is a map tile
function isTileRequest(url) {
  return TILE_PATTERNS.some((pattern) => pattern.test(url))
}

// Fetch event - cache-first for tiles
self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // Only handle tile requests
  if (!isTileRequest(url)) {
    return
  }

  event.respondWith(
    caches.open(TILE_CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached tile, but also refresh in background
          refreshTileInBackground(cache, event.request)
          return cachedResponse
        }

        // Not in cache, fetch and cache
        return fetchAndCache(cache, event.request)
      })
    }),
  )
})

// Fetch tile and add to cache
async function fetchAndCache(cache, request) {
  try {
    const response = await fetch(request)

    // Only cache successful responses
    if (response.ok) {
      // Clone response before caching (response can only be read once)
      cache.put(request, response.clone())

      // Periodically trim cache to prevent it from growing too large
      trimCacheIfNeeded(cache)
    }

    return response
  } catch (error) {
    // Network error - could return a placeholder tile here
    console.warn('Tile fetch failed:', request.url)
    throw error
  }
}

// Refresh tile in background (stale-while-revalidate)
async function refreshTileInBackground(cache, request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response)
    }
  } catch {
    // Network error during background refresh is fine
  }
}

// Trim cache if it's getting too large
let lastTrimTime = 0
async function trimCacheIfNeeded(cache) {
  const now = Date.now()
  // Only trim once per minute max
  if (now - lastTrimTime < 60000) return
  lastTrimTime = now

  try {
    const keys = await cache.keys()

    // Rough estimate: each tile ~15KB average
    const estimatedSize = keys.length * 15 * 1024

    if (estimatedSize > MAX_CACHE_SIZE) {
      // Delete oldest 20% of tiles
      const deleteCount = Math.floor(keys.length * 0.2)
      const toDelete = keys.slice(0, deleteCount)

      await Promise.all(toDelete.map((key) => cache.delete(key)))
      console.log(`Trimmed ${deleteCount} tiles from cache`)
    }
  } catch (error) {
    console.warn('Cache trim failed:', error)
  }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'clearTileCache') {
    caches.delete(TILE_CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ success: true })
    })
  }
})
