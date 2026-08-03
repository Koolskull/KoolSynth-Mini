/**
 * Local sample cache (IndexedDB) — browser-side bank for one-shots / grains.
 * Max file size enforced by callers (128 KiB).
 */

export const MAX_SAMPLE_BYTES = 128 * 1024;

export interface CachedSampleMeta {
  id: string;
  name: string;
  size: number;
  sampleRate: number;
  duration: number;
  createdAt: number;
}

export interface CachedSample extends CachedSampleMeta {
  /** Original file bytes */
  data: ArrayBuffer;
}

const DB_NAME = "koolsynth-mini-samples";
const DB_VER = 1;
const STORE = "samples";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb tx abort"));
  });
}

export async function listSamples(): Promise<CachedSampleMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as CachedSample[]).map(
        ({ id, name, size, sampleRate, duration, createdAt }) => ({
          id,
          name,
          size,
          sampleRate,
          duration,
          createdAt,
        }),
      );
      rows.sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSample(id: string): Promise<CachedSample | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as CachedSample) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putSample(sample: CachedSample): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(sample);
  await txDone(tx);
}

export async function deleteSample(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
