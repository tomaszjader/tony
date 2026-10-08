import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contour } from '../../src/shared/audio/phrase-contour.js';
test('phrase contour preserves pauses and rising melody', () => {
  const rate = 16000;
  let phase = 0;
  const samples = Float32Array.from({ length: rate * 2 }, (_, i) => {
    const t = i / rate;
    phase += (2 * Math.PI * (120 + t * 60)) / rate;
    return t > 0.85 && t < 1.15 ? 0 : 0.15 * Math.sin(phase);
  });
  const points = contour(samples, rate);
  assert.ok(points.some((p) => p.y === null));
  assert.ok(points.at(-1).y > points[0].y + 0.3);
});
test('silence produces no phrase contour', () =>
  assert.deepEqual(contour(new Float32Array(16000), 16000), []));
