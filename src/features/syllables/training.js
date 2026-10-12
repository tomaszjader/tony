export const emptyProgress = () => ({ exercises: {}, sessions: [], days: {} });

const validScore = (score) => Number.isInteger(score) && score >= 0 && score <= 100;
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weeklyProgress(progress, now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + i);
    const key = dayKey(date);
    const entry = progress.days?.[key];
    return {
      date,
      key,
      count: entry?.count ?? 0,
      average: entry ? Math.round(entry.total / entry.count) : null,
    };
  });
}

export function difficulty(entry) {
  if (!entry) return -1;
  const scores = entry.recent?.length ? entry.recent : [entry.last];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function readProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem('tony-progress'));
    if (
      !data ||
      !data.exercises ||
      typeof data.exercises !== 'object' ||
      !Array.isArray(data.sessions)
    )
      return emptyProgress();
    const exercises = {};
    for (const [id, entry] of Object.entries(data.exercises)) {
      if (
        entry &&
        Number.isInteger(entry.last) &&
        entry.last >= 0 &&
        entry.last <= 100 &&
        Number.isInteger(entry.best) &&
        entry.best >= entry.last &&
        entry.best <= 100 &&
        Number.isInteger(entry.count) &&
        entry.count > 0
      )
        exercises[id] = {
          ...entry,
          recent: Array.isArray(entry.recent)
            ? entry.recent.filter(validScore).slice(-5)
            : [entry.last],
        };
    }
    return {
      exercises,
      days: Object.fromEntries(
        Object.entries(data.days || {})
          .filter(
            ([key, entry]) =>
              /^\d{4}-\d{2}-\d{2}$/.test(key) &&
              entry &&
              Number.isInteger(entry.count) &&
              entry.count > 0 &&
              Number.isFinite(entry.total) &&
              entry.total >= 0 &&
              entry.total <= entry.count * 100,
          )
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-90),
      ),
      sessions: data.sessions
        .filter(
          (s) =>
            s &&
            Number.isFinite(s.date) &&
            Number.isFinite(s.average) &&
            s.average >= 0 &&
            s.average <= 100,
        )
        .slice(-20),
    };
  } catch {
    return emptyProgress();
  }
}

export function recordProgress(progress, id, score, now = new Date()) {
  const previous = progress.exercises[id];
  progress.exercises[id] = {
    last: score,
    best: Math.max(previous?.best ?? 0, score),
    count: (previous?.count ?? 0) + 1,
    recent: [...(previous?.recent ?? (previous ? [previous.last] : [])), score].slice(-5),
  };
  progress.days ??= {};
  const key = dayKey(now);
  const day = progress.days[key] ?? { count: 0, total: 0 };
  progress.days[key] = { count: day.count + 1, total: day.total + score };
  progress.days = Object.fromEntries(
    Object.entries(progress.days)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-90),
  );
  return previous ? score - previous.last : null;
}

export function trainingQueue(progress, tones, preferred = []) {
  const candidates = preferred.length ? [...new Set(preferred)] : tones.map((_, i) => i);
  candidates.sort(
    (a, b) => difficulty(progress.exercises[a]) - difficulty(progress.exercises[b]) || a - b,
  );
  if (preferred.length)
    return Array.from({ length: 5 }, (_, i) => candidates[i % candidates.length]);
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
  const average = Math.round(
    session.results.reduce((sum, score) => sum + score, 0) / session.results.length,
  );
  const difficult = [...new Set(session.queue.filter((_, i) => session.results[i] < 75))];
  return { average, difficult };
}
