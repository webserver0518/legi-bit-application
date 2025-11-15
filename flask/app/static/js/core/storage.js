/* ==========================================================================
   StorageManager v2 — Full SPA-grade localStorage wrapper
   Author: Matan Suliman (LegiBit)
   ========================================================================== */

/**
 * Returns localStorage safely.
 */
function getLS() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * StorageManager
 * - Supports namespaces (per-office / per-user)
 * - Supports TTL keys
 * - Supports event listeners
 */
class StorageManager {
  constructor(namespace = "default") {
    this.ns = namespace;
    this.ls = getLS();
    this.listeners = new Map();
  }

  /* ---------------------------------------------
     Internal Helpers
  --------------------------------------------- */

  _key(key) {
    return `${this.ns}:${key}`;
  }

  _now() {
    return Date.now();
  }

  _wrap(value, ttlMs) {
    return JSON.stringify({
      value,
      expiresAt: ttlMs ? this._now() + ttlMs : null,
    });
  }

  _unwrap(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt && parsed.expiresAt < this._now()) return null;
      return parsed.value;
    } catch {
      return null;
    }
  }

  _emit(key, value) {
    if (!this.listeners.has(key)) return;
    for (const cb of this.listeners.get(key)) cb(value);
  }

  /* ---------------------------------------------
     Public API
  --------------------------------------------- */

  /**
   * Get JSON value, with TTL validation.
   */
  get(key) {
    if (!this.ls) return null;
    const raw = this.ls.getItem(this._key(key));
    const val = this._unwrap(raw);
    return val;
  }

  /**
   * Set value with optional TTL (in seconds).
   */
  set(key, value, ttlSeconds = null) {
    if (!this.ls) return;
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : null;
    this.ls.setItem(this._key(key), this._wrap(value, ttlMs));
    this._emit(key, value);
  }

  /**
   * Remove key.
   */
  remove(key) {
    if (!this.ls) return;
    this.ls.removeItem(this._key(key));
    this._emit(key, null);
  }

  /**
   * Listen for changes in a specific key.
   * (Useful for cross-tabs or shared state)
   */
  onChange(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
  }

  offChange(key, callback) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback);
    }
  }

  /**
   * Clears only the namespace.
   */
  clearNamespace() {
    if (!this.ls) return;
    const prefix = `${this.ns}:`;
    for (let i = this.ls.length - 1; i >= 0; i--) {
      const k = this.ls.key(i);
      if (k.startsWith(prefix)) {
        this.ls.removeItem(k);
      }
    }
  }
}

/* --------------------------------------------------------------------------
   Global Compatibility Layer
-------------------------------------------------------------------------- */
if (typeof window !== "undefined") {
  window.Core = window.Core || {};
  window.Core.storage = {
    create: (ns) => new StorageManager(ns)
  };
  window.S = window.Core.storage;
}
