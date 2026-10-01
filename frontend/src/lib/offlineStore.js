/**
 * Local store for offline ticket control.
 *
 * Holds two things on the controller's device:
 *   - `manifests`: the list of valid tickets for a trip or event, downloaded
 *     before departure, so the device can decide with no network.
 *   - `queue`: the scans recorded offline, kept until the server accepts them.
 *
 * Raw IndexedDB rather than a wrapper library: the surface used here is small,
 * and a controller's phone should not pay for a dependency to store two lists.
 *
 * Every call resolves rather than throwing when IndexedDB is unavailable
 * (private browsing, blocked storage), so the scanner degrades to online-only
 * instead of breaking.
 */

const DB_NAME = 'dbillet-offline';
const DB_VERSION = 1;
const MANIFESTS = 'manifests';
const QUEUE = 'queue';

let dbPromise = null;

const openDb = () => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MANIFESTS)) {
        db.createObjectStore(MANIFESTS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: 'scan_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
};

const run = async (storeName, mode, action) => {
  const db = await openDb();
  if (!db) {
    return null;
  }
  return new Promise((resolve) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (error) {
      resolve(null);
      return;
    }
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request ? request.result : true);
    tx.onerror = () => resolve(null);
    tx.onabort = () => resolve(null);
  });
};

/** True when this device can store anything at all. */
export const offlineStorageAvailable = async () => (await openDb()) !== null;

const manifestKey = (eventId, date) => `${eventId}::${date || ''}`;

export const saveManifest = (manifest) =>
  run(MANIFESTS, 'readwrite', (store) =>
    store.put({ ...manifest, key: manifestKey(manifest.event_id, manifest.date) }));

export const getManifest = (eventId, date) =>
  run(MANIFESTS, 'readonly', (store) => store.get(manifestKey(eventId, date)));

export const listManifests = () =>
  run(MANIFESTS, 'readonly', (store) => store.getAll());

export const deleteManifest = (eventId, date) =>
  run(MANIFESTS, 'readwrite', (store) => store.delete(manifestKey(eventId, date)));

/** Record a scan taken offline. Keyed by scan_id, so re-queueing is harmless. */
export const queueScan = (scan) =>
  run(QUEUE, 'readwrite', (store) => store.put(scan));

export const listQueue = async () => (await run(QUEUE, 'readonly', (s) => s.getAll())) || [];

export const countQueue = async () => (await run(QUEUE, 'readonly', (s) => s.count())) || 0;

export const removeFromQueue = async (scanIds) => {
  const db = await openDb();
  if (!db || !scanIds.length) {
    return;
  }
  await new Promise((resolve) => {
    const tx = db.transaction(QUEUE, 'readwrite');
    const store = tx.objectStore(QUEUE);
    scanIds.forEach((id) => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
    tx.onabort = resolve;
  });
};

/**
 * Stable per-device identifier, so the server can tell "this device scanned it
 * twice" from "two devices scanned the same ticket" - the case a controller
 * must be warned about.
 */
const DEVICE_KEY = 'dbillet-device-id';

export const getDeviceId = () => {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) {
      return existing;
    }
    const generated =
      (crypto.randomUUID && crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, generated);
    return generated;
  } catch (error) {
    // Storage blocked: fall back to a per-session id. Conflict detection still
    // works within this session.
    return `dev-session-${Math.random().toString(36).slice(2)}`;
  }
};
