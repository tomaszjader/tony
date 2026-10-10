export const emptyProgress = () => ({ exercises: {}, sessions: [] });

export function readProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem('tony-progress'));
    if (!data || !data.exercises || typeof data.exercises !== 'object' || !Array.isArray(data.sessions))
      return emptyProgress();
    const exercises = {};
    for (const [id, entry] of Object.entries(data.exercises)) {
      if (entry && Number.isInteger(entry.last) && entry.last >= 0 && entry.last <= 100 &&
        Number.isInteger(entry.best) && entry.best >= entry.last && entry.best <= 100 &&
        Number.isInteger(entry.count) && entry.count > 0) exercises[id] = entry;
    }
    return { exercises, sessions: data.sessions.filter((s) =>
      s && Number.isFinite(s.date) && Number.isFinite(s.average) && s.average >= 0 && s.average <= 100
    ).slice(-20) };
  } catch { return emptyProgress(); }
}

export function recordProgress(progress, id, score) {
  const previous = progress.exercises[id];
  progress.exercises[id] = { last: score, best: Math.max(previous?.best ?? 0, score), count: (previous?.count ?? 0) + 1 };
  return previous ? score - previous.last : null;
}

export function trainingQueue(progress, tones, preferred = []) {
  const candidates = preferred.length ? [...new Set(preferred)] : tones.map((_, i) => i);
  candidates.sort((a, b) => (progress.exercises[a]?.last ?? -1) - (progress.exercises[b]?.last ?? -1) || a - b);
  if (preferred.length) return Array.from({ length: 5 }, (_, i) => candidates[i % candidates.length]);
  const seen = new Set();
  const queue = candidates.filter((id) => {
    if (seen.has(tones[id])) return false;
    seen.add(tones[id]);
    return true;
  });
  while (queue.length < 5) queue.push(candidates[0]);
  return queue.slice(0, 5);
}

export function createSession(queue) {
  return { queue, position: 0, results: Array(queue.length).fill(null), complete: false };
}

export function acceptResult(session, result) {
  if (!session || session.complete || result.uncertain) return false;
  session.results[session.position] = result.score;
  return true;
}

export function advanceSession(session) {
  if (!session || session.complete || session.results[session.position] === null) return false;
  if (session.position === session.queue.length - 1) session.complete = true;
  else session.position++;
  return true;
}

export function sessionSummary(session) {
  const average = Math.round(session.results.reduce((sum, score) => sum + score, 0) / session.results.length);
  const difficult = [...new Set(session.queue.filter((_, i) => session.results[i] < 75))];
  return { average, difficult };
}
