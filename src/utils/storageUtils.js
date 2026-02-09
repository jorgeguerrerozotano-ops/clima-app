/**
 * storageUtils.js — Claves de caché por ubicación, IndexedDB histórico, localStorage ligero.
 */

const DB_NAME = 'ClimaRetroDB';
const STORE_NAME = 'history_store';
const DB_VERSION = 1;

const openHistoryDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject("IndexedDB not supported");
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("Error opening DB");
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/** Redondea a 1 decimal. Agrupa ubicaciones en celdas de ~11.1km. */
export const getClimateKey = (lat, lon) => {
  const latK = parseFloat(lat).toFixed(1);
  const lonK = parseFloat(lon).toFixed(1);
  return `hist_v3_${latK}_${lonK}`;
};

export const getHistoryFromDB = async (key) => {
  try {
    const db = await openHistoryDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiry > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("DB Read Error:", e);
    return null;
  }
};

export const saveHistoryToDB = async (key, data) => {
  try {
    const db = await openHistoryDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const item = {
        data: data,
        expiry: Date.now() + (1000 * 60 * 60 * 24 * 30)
      };
      store.put(item, key);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject("DB Write Error");
    });
  } catch (e) {
    console.warn("DB Write Error:", e);
  }
};

/** Caché ligera localStorage (compatibilidad). */
export const getCachedData = (key) => {
  try {
    const item = localStorage.getItem('climaretro_data_' + key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem('climaretro_data_' + key);
      return null;
    }
    return parsed.data;
  } catch (e) {
    return null;
  }
};

export const setCachedData = (key, data) => {
  try {
    const item = { data: data, expiry: Date.now() + (1000 * 60 * 60 * 24) };
    localStorage.setItem('climaretro_data_' + key, JSON.stringify(item));
  } catch (e) {
    console.warn("LocalStorage full");
  }
};
