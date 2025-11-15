/* storage.js (IIFE, browser globals) */
(function () {
  'use strict';

  // Ensure Core namespace
  window.Core = window.Core || {};

  // Fallback memory store if localStorage is unavailable
  const memory = new Map();

  function canUseLocalStorage() {
    try {
      const k = '__ls_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (_) {
      return false;
    }
  }

  const LS_OK = canUseLocalStorage();

  function nsKey(ns, k) {
    return `app:${ns}:${k}`;
  }

  function readRaw(key) {
    if (LS_OK) return localStorage.getItem(key);
    return memory.get(key) ?? null;
  }

  function writeRaw(key, val) {
    if (LS_OK) localStorage.setItem(key, val);
    else memory.set(key, val);
  }

  function removeRaw(key) {
    if (LS_OK) localStorage.removeItem(key);
    else memory.delete(key);
  }

  function create(namespace) {
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('Core.storage.create(namespace) requires a string namespace');
    }
    return {
      get(key, fallback = null) {
        const raw = readRaw(nsKey(namespace, key));
        if (raw == null) return fallback;
        try {
          return JSON.parse(raw);
        } catch (_) {
          return raw;
        }
      },
      set(key, value) {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        writeRaw(nsKey(namespace, key), val);
        return true;
      },
      remove(key) {
        removeRaw(nsKey(namespace, key));
        return true;
      },
      clear() {
        if (LS_OK) {
          const prefix = `app:${namespace}:`;
          const toDelete = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) toDelete.push(k);
          }
          toDelete.forEach((k) => localStorage.removeItem(k));
        } else {
          const prefix = `app:${namespace}:`;
          for (const k of memory.keys()) {
            if (k.startsWith(prefix)) memory.delete(k);
          }
        }
      },
      keys() {
        const arr = [];
        const prefix = `app:${namespace}:`;
        if (LS_OK) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) arr.push(k.substring(prefix.length));
          }
        } else {
          for (const k of memory.keys()) {
            if (k.startsWith(prefix)) arr.push(k.substring(prefix.length));
          }
        }
        return arr;
      }
    };
  }

  window.Core.storage = { create };
})();
