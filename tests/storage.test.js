import { test } from 'node:test';
import assert from 'node:assert/strict';

test('IndexedDB can be opened again after a temporary failure', async () => {
  const original = globalThis.indexedDB;
  let opens = 0;
  const db = {
    transaction() {
      const tx = {
        objectStore() {
          return {
            getAll() {
              const request = { result: [] };
              queueMicrotask(() => {
                request.onsuccess();
                tx.oncomplete();
              });
              return request;
            },
          };
        },
      };
      return tx;
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = { result: db, error: new Error('temporary storage error') };
      const fail = ++opens === 1;
      queueMicrotask(() => (fail ? request.onerror() : request.onsuccess()));
      return request;
    },
  };
  try {
    const { loadAttempts } = await import('../src/storage.js');
    await assert.rejects(loadAttempts(), /temporary storage error/);
    assert.deepEqual(await loadAttempts(), []);
    assert.equal(opens, 2);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
