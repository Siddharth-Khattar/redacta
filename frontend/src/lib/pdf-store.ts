// ABOUTME: IndexedDB persistence layer for storing the active PDF file.
// ABOUTME: Enables workspace state to survive page reloads without a backend.

const DB_NAME = "redacta";
const DB_VERSION = 1;
const STORE_NAME = "files";
const CURRENT_PDF_KEY = "current-pdf";

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Persist a PDF file to IndexedDB so it survives reloads. */
export async function storePdf(file: File): Promise<void> {
  const db = await openDB();
  const data = await file.arrayBuffer();
  const stored: StoredFile = {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    data,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(stored, CURRENT_PDF_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load the previously stored PDF file, or null if none exists. */
export async function loadPdf(): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(CURRENT_PDF_KEY);
    request.onsuccess = () => {
      const stored = request.result as StoredFile | undefined;
      if (!stored) {
        resolve(null);
        return;
      }
      const file = new File([stored.data], stored.name, {
        type: stored.type,
        lastModified: stored.lastModified,
      });
      resolve(file);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Remove the stored PDF from IndexedDB. */
export async function clearPdf(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(CURRENT_PDF_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
