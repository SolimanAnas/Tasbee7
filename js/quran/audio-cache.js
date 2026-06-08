/* audio-cache.js — Cache API wrapper for offline audio playback */
const AudioCache = (function () {
  'use strict';

  const CACHE_NAME = 'audio-cache-v1';
  const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200MB
  const METADATA_KEY = 'audio-cache-metadata';

  let _cache = null;

  async function getCache() {
    if (_cache) return _cache;
    _cache = await caches.open(CACHE_NAME);
    return _cache;
  }

  function _getMetadata() {
    try {
      return JSON.parse(localStorage.getItem(METADATA_KEY) || '{"entries":{},"totalSize":0}');
    } catch (_) {
      return { entries: {}, totalSize: 0 };
    }
  }

  function _saveMetadata(meta) {
    localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
  }

  function _cacheKey(url) {
    return 'audio:' + url;
  }

  /**
   * Store an audio response in cache
   */
  async function put(url, response) {
    if (!url || !response) return false;
    try {
      const cache = await getCache();
      const clone = response.clone();
      await cache.put(_cacheKey(url), clone);

      // Update metadata
      const meta = _getMetadata();
      const body = await clone.blob();
      const size = body.size;
      meta.entries[url] = { size: size, cachedAt: Date.now() };
      meta.totalSize = Object.values(meta.entries).reduce((s, e) => s + (e.size || 0), 0);

      // Evict oldest if over limit
      if (meta.totalSize > MAX_CACHE_SIZE) {
        const sorted = Object.entries(meta.entries)
          .sort((a, b) => (a[1].cachedAt || 0) - (b[1].cachedAt || 0));
        while (meta.totalSize > MAX_CACHE_SIZE * 0.8 && sorted.length > 0) {
          const [oldestUrl] = sorted.shift();
          await cache.delete(_cacheKey(oldestUrl));
          delete meta.entries[oldestUrl];
          meta.totalSize = Object.values(meta.entries).reduce((s, e) => s + (e.size || 0), 0);
        }
      }

      _saveMetadata(meta);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get cached audio response
   */
  async function get(url) {
    if (!url) return null;
    try {
      const cache = await getCache();
      const response = await cache.match(_cacheKey(url));
      return response || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Fetch audio with cache-first strategy
   */
  async function fetchCached(url) {
    // Try cache first
    const cached = await get(url);
    if (cached) return cached;

    // Fetch from network
    try {
      const response = await fetch(url);
      if (response && response.ok) {
        // Cache in background
        put(url, response).catch(() => {});
        return response;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Check if a URL is cached
   */
  async function isCached(url) {
    const cache = await getCache();
    const response = await cache.match(_cacheKey(url));
    return !!response;
  }

  /**
   * Get cache stats
   */
  function getStats() {
    const meta = _getMetadata();
    const count = Object.keys(meta.entries).length;
    const totalBytes = meta.totalSize || 0;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    return { count, totalBytes, totalMB };
  }

  /**
   * Clear all cached audio
   */
  async function clearAll() {
    try {
      await caches.delete(CACHE_NAME);
      _cache = null;
      _saveMetadata({ entries: {}, totalSize: 0 });
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Clear cached audio for a specific reciter
   */
  async function clearReciter(reciterId) {
    const meta = _getMetadata();
    const cache = await getCache();
    const keys = await cache.keys();
    let cleared = 0;

    for (const req of keys) {
      const url = req.url.replace('audio:', '');
      if (url.includes('/' + reciterId + '/')) {
        await cache.delete(req);
        delete meta.entries[url];
        cleared++;
      }
    }

    meta.totalSize = Object.values(meta.entries).reduce((s, e) => s + (e.size || 0), 0);
    _saveMetadata(meta);
    return cleared;
  }

  /**
   * Get list of cached surahs for a reciter
   */
  async function getCachedSurahs(reciterId) {
    const meta = _getMetadata();
    const surahs = new Set();
    for (const url of Object.keys(meta.entries)) {
      if (url.includes('/' + reciterId + '/')) {
        const match = url.match(/\/(\d+):(\d+)\//);
        if (match) surahs.add(parseInt(match[1]));
      }
    }
    return Array.from(surahs).sort((a, b) => a - b);
  }

  return {
    put,
    get,
    fetchCached,
    isCached,
    getStats,
    clearAll,
    clearReciter,
    getCachedSurahs
  };
})();
