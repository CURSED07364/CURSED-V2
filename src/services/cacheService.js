class CacheService {
  constructor(defaultTTL = 300000, maxSize = 5000) { // Default TTL: 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.startCleanup();
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      // If still over max size after TTL cleanup, evict oldest entries
      if (this.cache.size > this.maxSize) {
        const toRemove = this.cache.size - this.maxSize;
        let removed = 0;
        for (const key of this.cache.keys()) {
          if (removed >= toRemove) break;
          this.cache.delete(key);
          removed++;
        }
      }
    }, 60000); // Cleanup every minute
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.cache.clear();
  }

  // Helper for DB get-or-set pattern
  async getOrFetch(key, fetchFn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    this.set(key, data, ttl);
    return data;
  }
}

// Export singleton instance
module.exports = new CacheService();
