import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resample16k } from '../../src/shared/transcription/local-whisper.js';
test('microphone audio is resampled to the required 16 kHz', () => {
  const samples = Float32Array.from({ length: 48000 }, (_, i) =>
    Math.sin((2 * Math.PI * 200 * i) / 48000),
  );
  const result = resample16k(samples, 48000);
  assert.equal(result.length, 16000);
  assert.ok(Math.abs(result[20] - 1) < 0.001);
});
