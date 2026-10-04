import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, analyze, target } from '../src/pitch.js';
const rate = 16000;
function signal(tone, base = 180) {
  let phase = 0;
  return Float32Array.from({ length: rate }, (_, i) => {
    const hz = base * 2 ** (target(tone, i / rate) - 0.5);
    phase += (2 * Math.PI * hz) / rate;
    return 0.3 * Math.sin(phase) + 0.06 * Math.sin(2 * phase);
  });
}
test('F0 estimates across low and high voices', () => {
  for (const hz of [85, 180, 310, 440]) {
    const frame = Float32Array.from(
      { length: 2048 },
      (_, i) => 0.3 * Math.sin((2 * Math.PI * hz * i) / rate),
    );
    assert.ok(Math.abs(detectPitch(frame, rate).hz - hz) / hz < 0.04);
  }
});
test('silence and very short attempts are rejected', () => {
  assert.equal(detectPitch(new Float32Array(2048), rate), null);
  assert.throws(() => analyze(new Float32Array(rate), rate, 1));
  assert.throws(() => analyze(signal(1).slice(0, 1000), rate, 1));
});
test('expected contours outperform opposite contours across voice ranges', () => {
  for (const base of [110, 220])
    for (const tone of [1, 2, 3, 4]) {
      const audio = signal(tone, base);
      const correct = analyze(audio, rate, tone);
      assert.ok(correct.score > 65, `tone ${tone}: ${correct.score}`);
      if (tone === 2 || tone === 4)
        assert.ok(correct.score > analyze(audio, rate, tone === 2 ? 4 : 2).score + 25);
    }
});
test('quiet short syllables at microphone sample rates survive silence and noise', () => {
  for (const sampleRate of [16000, 44100, 48000])
    for (const hz of [90, 240, 520]) {
      let seed = 17;
      const audio = Float32Array.from({ length: sampleRate * 1.5 }, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = (seed / 2 ** 32 - 0.5) * 0.001;
        const time = i / sampleRate;
        if (time < 0.5 || time > 0.85) return noise;
        return (
          noise +
          0.006 * Math.sin(2 * Math.PI * hz * time) +
          0.008 * Math.sin(4 * Math.PI * hz * time)
        );
      });
      const result = analyze(audio, sampleRate, 1);
      assert.ok(result.points.length > 10);
      assert.ok(result.score > 80, `${sampleRate}, ${hz}: ${result.score}`);
    }
});
test('noise alone is rejected', () => {
  let seed = 12;
  const noise = Float32Array.from({ length: rate }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.1;
  });
  assert.throws(() => analyze(noise, rate, 1));
});
