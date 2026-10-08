let worker;
let nextId = 0;
const pending = new Map();

function stopWorker(message) {
  worker?.terminate();
  worker = null;
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(Error(message));
  }
  pending.clear();
}

function request(operation, samples, rate, tone) {
  return new Promise((resolve, reject) => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./pitch.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          const job = pending.get(data.id);
          if (!job) return;
          clearTimeout(job.timer);
          pending.delete(data.id);
          if (data.error) job.reject(Error(data.error));
          else job.resolve(data.result);
        };
        worker.onerror = worker.onmessageerror = () =>
          stopWorker('Nie udało się uruchomić analizy głosu. Spróbuj ponownie.');
      }
      const id = ++nextId;
      const timer = setTimeout(
        () => stopWorker('Analiza głosu trwała za długo. Spróbuj ponownie.'),
        60000,
      );
      pending.set(id, { resolve, reject, timer });
      try {
        // Transfer a copy: callers still need the original samples for WAV and Whisper.
        const copy = new Float32Array(samples);
        worker.postMessage({ id, operation, samples: copy, rate, tone }, [copy.buffer]);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    } catch {
      reject(Error('Ta przeglądarka nie obsługuje analizy głosu w tle.'));
    }
  });
}

export const analyzeSyllable = (samples, rate, tone) => request('syllable', samples, rate, tone);
export const analyzeContour = (samples, rate) => request('contour', samples, rate);

globalThis.addEventListener?.('pagehide', () => stopWorker('Analiza została przerwana.'));
