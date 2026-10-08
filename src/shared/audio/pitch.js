export const patterns = {
  1: [0.8, 0.8, 0.8, 0.8, 0.8],
  2: [0.25, 0.32, 0.48, 0.67, 0.9],
  3: [0.55, 0.25, 0.12, 0.3, 0.65],
  4: [0.95, 0.75, 0.5, 0.25, 0.08],
};
export function target(tone, x) {
  const a = patterns[tone],
    p = x * (a.length - 1),
    i = Math.min(a.length - 2, Math.floor(p));
  return a[i] + (a[i + 1] - a[i]) * (p - i);
}
// YIN cumulative normalized difference. The first reliable minimum avoids
// confusing strong harmonics with the fundamental frequency.
export function detectPitch(frame, rate) {
  const mean = frame.reduce((a, b) => a + b, 0) / frame.length;
  const data = Float32Array.from(frame, (x) => x - mean);
  const rms = Math.sqrt(data.reduce((a, b) => a + b * b, 0) / data.length);
  if (rms < 0.0015) return null;
  const min = Math.max(2, Math.floor(rate / 650)),
    max = Math.min(Math.floor(rate / 60), Math.floor(data.length / 2) - 1),
    length = data.length - max;
  const diff = new Float32Array(max + 1);
  let total = 0;
  for (let lag = 1; lag <= max; lag++) {
    let sum = 0;
    for (let j = 0; j < length; j++) sum += (data[j] - data[j + lag]) ** 2;
    total += sum;
    diff[lag] = total ? (sum * lag) / total : 1;
  }
  let lag = min;
  for (; lag < max; lag++)
    if (diff[lag] < 0.22) {
      while (lag < max && diff[lag + 1] < diff[lag]) lag++;
      break;
    }
  if (lag >= max) {
    lag = min;
    for (let j = min + 1; j < max; j++) if (diff[j] < diff[lag]) lag = j;
    if (diff[lag] > 0.35) return null;
  }
  const a = diff[lag - 1],
    b = diff[lag],
    c = diff[lag + 1],
    den = 2 * (2 * b - a - c);
  const refined = lag + (den ? (c - a) / den : 0);
  return { hz: rate / refined, rms, confidence: 1 - b };
}
export function analyze(samples, rate, tone) {
  // Average samples before decimation; a consistent time window works with
  // both 16 kHz test signals and common 44.1/48 kHz microphone recordings.
  const factor = Math.max(1, Math.floor(rate / 16000));
  if (factor > 1) {
    const reduced = new Float32Array(Math.floor(samples.length / factor));
    for (let i = 0; i < reduced.length; i++) {
      for (let j = 0; j < factor; j++) reduced[i] += samples[i * factor + j] / factor;
    }
    samples = reduced;
    rate /= factor;
  }
  const size = Math.round(rate * 0.05),
    hop = Math.round(rate * 0.01),
    frames = [];
  for (let i = 0; i + size <= samples.length; i += hop) {
    const p = detectPitch(samples.subarray(i, i + size), rate);
    frames.push(p ? { ...p, t: i / rate } : null);
  }
  const detected = frames.filter(Boolean);
  if (!detected.length)
    throw new Error(
      'Nagranie zostało zapisane, ale nie wykryto wysokości głosu. Sprawdź odsłuch: powiedz samą sylabę wyraźnie przez około pół sekundy.',
    );
  // Select the strongest continuous voiced segment, ignoring background
  // fragments and allowing short unvoiced breaks within a syllable.
  const groups = [];
  for (const p of detected) {
    if (!groups.length || p.t - groups.at(-1).at(-1).t > 0.15) groups.push([]);
    groups.at(-1).push(p);
  }
  groups.sort(
    (a, b) =>
      b.reduce((s, p) => s + p.rms * p.confidence, 0) -
      a.reduce((s, p) => s + p.rms * p.confidence, 0),
  );
  const valid = groups[0];
  if (valid.length < 8 || valid.at(-1).t - valid[0].t < 0.12)
    throw new Error(
      'Wykryto tylko bardzo krótki fragment głosu. Wypowiedz sylabę nieco dłużej, przez około pół sekundy. Nagranie możesz odsłuchać poniżej.',
    );
  const start = valid[0].t,
    end = valid.at(-1).t;
  const coverage = valid.length / (1 + (end - start) / 0.01);
  const confidence = valid.reduce((s, p) => s + p.confidence, 0) / valid.length;
  const uncertain = coverage < 0.6 || confidence < 0.8;
  const logs = valid.map((p) => Math.log2(p.hz) * 12).sort((a, b) => a - b),
    median = logs[Math.floor(logs.length / 2)];
  const expected = valid
      .map((p) => target(tone, (p.t - start) / (end - start)))
      .sort((a, b) => a - b),
    center = expected[Math.floor(expected.length / 2)];
  const points = valid.map((p, i) => {
    const neighborhood = valid
      .slice(Math.max(0, i - 2), i + 3)
      .map((q) => Math.log2(q.hz) * 12)
      .sort((a, b) => a - b);
    return {
      x: (p.t - start) / (end - start),
      y: Math.max(
        0,
        Math.min(1, center + (neighborhood[Math.floor(neighborhood.length / 2)] - median) / 12),
      ),
    };
  });
  const error = points.reduce((s, p) => s + (p.y - target(tone, p.x)) ** 2, 0) / points.length;
  const score = Math.max(0, Math.min(100, Math.round(100 - 160 * Math.sqrt(error))));
  return { points, score, uncertain };
}
