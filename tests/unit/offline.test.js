import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../src/pwa/service-worker.js', import.meta.url), 'utf8')
  .replace("'__TONY_CACHE__'", '"tony-test"')
  .replace('__TONY_FILES__', '[]');
function harness(fetcher, matcher) {
  const listeners = {};
  vm.runInNewContext(source, {
    self: {
      registration: { scope: 'https://example.com/tony/' },
      addEventListener: (type, fn) => (listeners[type] = fn),
    },
    location: { origin: 'https://example.com' },
    caches: { match: matcher },
    fetch: fetcher,
    Response,
    URL,
  });
  return listeners.fetch;
}
test('offline scripts use cache without making a network request', async () => {
  let called = false;
  const handler = harness(
    () => {
      called = true;
      throw Error('offline');
    },
    async () => new Response('cached-js'),
  );
  let output;
  handler({
    request: { method: 'GET', url: 'https://example.com/tony/assets/app.js', mode: 'cors' },
    respondWith: (promise) => (output = promise),
  });
  assert.equal(await (await output).text(), 'cached-js');
  assert.equal(called, false);
});
test('offline navigation falls back to the cached app shell', async () => {
  const handler = harness(
    () => {
      throw Error('offline');
    },
    async (request) => (typeof request === 'string' ? new Response('shell') : undefined),
  );
  let output;
  handler({
    request: { method: 'GET', url: 'https://example.com/tony/?v=5', mode: 'navigate' },
    respondWith: (promise) => (output = promise),
  });
  assert.equal(await (await output).text(), 'shell');
});
test('OpenAI requests are never intercepted or cached', () => {
  const handler = harness(
    () => {
      throw Error('unexpected');
    },
    () => {
      throw Error('unexpected');
    },
  );
  let intercepted = false;
  handler({
    request: { method: 'POST', url: 'https://api.openai.com/v1/audio/transcriptions' },
    respondWith: () => (intercepted = true),
  });
  assert.equal(intercepted, false);
});
