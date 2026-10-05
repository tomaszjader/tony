import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { analyze } from '../src/pitch.js';
import { contour } from '../src/phrase-contour.js';
import { analyzeSyllable, analyzeContour } from '../src/pitch-analysis.js';

// Run the browser worker unchanged in a real background thread.
const workers = [];
class BrowserWorker {
  constructor(url) {
    this.thread = new NodeWorker(
      `const { parentPort } = require('node:worker_threads');
       globalThis.self = { postMessage: data => parentPort.postMessage(data) };
       import(${JSON.stringify(url.href)}).then(() => {
         parentPort.on('message', data => self.onmessage({ data }));
       });`,
      { eval: true },
    );
    this.thread.on('message', (data) => this.onmessage?.({ data }));
    this.thread.on('error', (error) => this.onerror?.(error));
    workers.push(this);
  }
  postMessage(data, transfer) {
    this.thread.postMessage(data, transfer);
  }
  terminate() {
    return this.thread.terminate();
  }
}

test('background pitch analysis preserves results, samples, and recovers after errors', async (t) => {
  const original = globalThis.Worker;
  globalThis.Worker = BrowserWorker;
  t.after(async () => {
    globalThis.Worker = original;
    await Promise.all(workers.map((worker) => worker.terminate()));
  });
  const rate = 16000;
  const samples = Float32Array.from(
    { length: rate },
    (_, i) => 0.2 * Math.sin((2 * Math.PI * 180 * i) / rate),
  );
  const before = samples.slice();
  const [syllable, phrase] = await Promise.all([
    analyzeSyllable(samples, rate, 1),
    analyzeContour(samples, rate),
  ]);
  assert.deepEqual(syllable, analyze(samples, rate, 1));
  assert.deepEqual(phrase, contour(samples, rate));
  assert.deepEqual(samples, before, 'transfer must not detach or change caller audio');
  await assert.rejects(analyzeSyllable(new Float32Array(rate), rate, 1), /nie wykryto/);
  assert.deepEqual(await analyzeContour(new Float32Array(rate), rate), []);
  assert.deepEqual(await analyzeSyllable(samples, rate, 1), syllable);

  const interrupted = analyzeContour(samples, rate);
  workers.at(-1).onerror(Error('worker crashed'));
  await assert.rejects(interrupted, /Spróbuj ponownie/);
  assert.deepEqual(await analyzeContour(samples, rate), phrase);
});
