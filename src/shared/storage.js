let database;
function open() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const req = indexedDB.open('tony-audio', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('references', { keyPath: 'text' });
      db.createObjectStore('attempts', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        database = null;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  }).catch((error) => {
    database = null;
    throw error;
  });
  return database;
}
async function run(store, mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      request = operation(tx.objectStore(store));
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error('Nie zapisano danych.'));
  });
}
export const saveReference = (text, blob) =>
  run('references', 'readwrite', (s) => s.put({ text, blob }));
export const loadReference = async (text) =>
  (await run('references', 'readonly', (s) => s.get(text)))?.blob;
export const saveAttempt = (attempt) => run('attempts', 'readwrite', (s) => s.put(attempt));
export const loadAttempts = async () =>
  (await run('attempts', 'readonly', (s) => s.getAll())).sort((a, b) => b.date - a.date);
export const deleteAttempt = (id) => run('attempts', 'readwrite', (s) => s.delete(id));
