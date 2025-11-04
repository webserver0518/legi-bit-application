/*  core/storage.js  */

/* --------------------------------------------------------------------------
   Key Definitions
   -------------------------------------------------------------------------- */

/**
 * Centralized storage keys used across the application.
 * Keeps names consistent between modules and prevents typos.
 */
export const STORAGE_KEYS = {
  currentSiteContent: 'site.currentContent',
  currentDashboardContent: 'dashboard.currentContent',
  currentSubSidebar: 'dashboard.subSidebar',
};

/**
 * Mapping of old (legacy) key names to new ones.
 * Used during migration to preserve existing user data.
 */
const LEGACY_KEYS = {
  current_site_content: STORAGE_KEYS.currentSiteContent,
};

/* --------------------------------------------------------------------------
   Internal Helpers
   -------------------------------------------------------------------------- */

/**
 * Returns the window.localStorage object if available, otherwise null.
 * Wrapped in try/catch to handle environments where localStorage access
 * is blocked (e.g., privacy mode or SSR).
 */
function getLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (err) {
    console.warn('localStorage unavailable:', err);
    return null;
  }
}

/**
 * Migrates legacy key names to the new standardized ones.
 * Copies values from old keys to new ones (if missing) and deletes old keys.
 * Runs immediately upon module import.
 */
function migrateLegacyKeys() {
  const storage = getLocalStorage();
  if (!storage) return;

  Object.entries(LEGACY_KEYS).forEach(([oldKey, newKey]) => {
    const existing = storage.getItem(oldKey);
    if (existing !== null) {
      // Only migrate if the new key doesn’t already exist
      if (!storage.getItem(newKey)) {
        storage.setItem(newKey, existing);
      }
      storage.removeItem(oldKey);
    }
  });
}

// Perform migration once at import time
migrateLegacyKeys();


/* --------------------------------------------------------------------------
   Public API
   -------------------------------------------------------------------------- */

/**
 * Retrieves and parses a JSON value from localStorage.
 * Returns null if key is missing, storage unavailable, or parsing fails.
 *
 * @param {string} key - Storage key to read.
 * @returns {any|null} Parsed JSON value or null on error.
 */
export function getJSON(key) {
  const storage = getLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse JSON from storage key', key, err);
    return null;
  }
}

/**
 * Stores a JSON-serializable value in localStorage.
 * Removes the key entirely if value is undefined.
 *
 * @param {string} key   - Storage key to write.
 * @param {any}    value - JSON-serializable value or undefined to remove.
 */
export function setJSON(key, value) {
  const storage = getLocalStorage();
  if (!storage) return;
  if (value === undefined) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(value));
}

/**
 * Removes an item from localStorage safely.
 *
 * @param {string} key - Storage key to delete.
 */
export function remove(key) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(key);
}

/* --------------------------------------------------------------------------
   Global Exposure (Legacy Compatibility)
   --------------------------------------------------------------------------
   Exposes the module under window.Core.storage for scripts that still rely
   on global access until the full ES-module migration is complete.
   -------------------------------------------------------------------------- */
if (typeof window !== 'undefined') {
  window.Core = window.Core || {};
  window.Core.storage = { STORAGE_KEYS, getJSON, setJSON, remove };
}