import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
let transcriber;
async function load() {
  if (!transcriber)
    transcriber = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (event) => {
        if (event.status === 'progress')
          self.postMessage({
            type: 'progress',
            text: `Pobieram model: ${event.file} · ${Math.round(event.progress || 0)}%`,
          });
      },
    }).catch((e) => {
      transcriber = null;
      throw e;
    });
  return transcriber;
}
self.onmessage = async (event) => {
  try {
    const model = await load();
    if (event.data.type === 'prepare') {
      self.postMessage({ type: 'done', text: '' });
      return;
    }
    self.postMessage({ type: 'progress', text: 'Rozpoznaję mowę lokalnym modelem Whisper…' });
    const output = await model(event.data.samples, {
      language: 'chinese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      max_new_tokens: 150,
      do_sample: false,
    });
    self.postMessage({ type: 'done', text: output.text.trim() });
  } catch {
    self.postMessage({
      type: 'error',
      text: 'Nie udało się uruchomić lokalnego Whispera. Sprawdź internet przy pierwszym pobraniu lub wybierz OpenAI.',
    });
  }
};
