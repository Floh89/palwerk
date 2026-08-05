const DB_NAME = 'palwerk';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'current';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(fallback) {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (value) return value;

    const legacy = localStorage.getItem('palwerk-state-v1');
    if (legacy) {
      const migrated = JSON.parse(legacy);
      await saveState({ ...fallback, ...migrated, schemaVersion: 1 });
      localStorage.removeItem('palwerk-state-v1');
      return { ...fallback, ...migrated, schemaVersion: 1 };
    }
  } catch (error) {
    console.warn('IndexedDB unavailable, using fallback state.', error);
  }
  return structuredClone(fallback);
}

export async function saveState(state) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
