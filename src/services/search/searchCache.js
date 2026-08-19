/**
 * searchCache.js — LRU cache for AUR candidate packages.
 *
 * Caches RAW AUR candidate results (not context-dependent rankings).
 * Ranking is applied fresh on every access using current installed context.
 *
 * Properties:
 *   - Key: normalized query string
 *   - Value: raw AUR candidate packages array
 *   - TTL: 3 minutes (entries expire after this duration)
 *   - Max entries: 100
 *   - Eviction: Least Recently Used (accessed or inserted)
 *   - Expired entries removed opportunistically on access
 */

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const CACHE_MAX_ENTRIES = 100;

class SearchCache {
  constructor() {
    /** @type {Map<string, { data: object[], accessedAt: number, createdAt: number }>} */
    this.store = new Map();
  }

  /**
   * Get cached candidates for a normalized query key.
   * Returns null on miss or expiry. Updates access time on hit (LRU).
   *
   * @param {string} key - Normalized query string
   * @returns {object[]|null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    // TTL check
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      this.store.delete(key);
      return null;
    }

    // Update access time (LRU)
    entry.accessedAt = Date.now();
    // Move to end of Map insertion order for LRU
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.data;
  }

  /**
   * Store AUR candidate packages for a normalized query key.
   *
   * @param {string} key - Normalized query string
   * @param {object[]} data - Raw AUR candidate packages
   */
  set(key, data) {
    // Evict expired entries opportunistically
    this._evictExpired();

    // If at capacity, evict the least recently used (first in Map)
    while (this.store.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      data,
      accessedAt: Date.now(),
      createdAt: Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove expired entries.
   */
  _evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.createdAt > CACHE_TTL_MS) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Current cache size.
   * @returns {number}
   */
  get size() {
    return this.store.size;
  }
}

// Singleton instance
export const searchCache = new SearchCache();
