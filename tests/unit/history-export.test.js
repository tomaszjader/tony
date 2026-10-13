import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { exportHistory } from '../../src/shared/history-export.js';

test('export includes every recording with original bytes, metadata and progress', async () => {
  const attempts = Array.from({ length: 23 }, (_, i) => ({
    id: String(i),
    date: 123,
    phrase: { text: '你好' },
    transcript: '你好',
    blob: new Blob([Uint8Array.of(i, 1, 2)], {
      type: i === 0 ? 'audio/webm;codecs=opus' : 'audio/wav',
    }),
  }));
  const progress = { exercises: { 0: { last: 80 } }, days: {}, sessions: [] };
  const archive = await exportHistory(attempts, progress, new Date('2026-10-13T12:00:00Z'));
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  const history = JSON.parse(strFromU8(files['historia.json']));
  assert.equal(history.recordings.length, 23);
  assert.equal(history.recordings[0].file, 'nagrania/0001.webm');
  assert.equal(history.recordings[22].transcript, '你好');
  assert.deepEqual(files[history.recordings[22].file], Uint8Array.of(22, 1, 2));
  assert.deepEqual(history.progress, progress);
  assert.equal(history.recordings[0].blob, undefined);
});
