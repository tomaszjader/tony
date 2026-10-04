const endpoint = 'https://api.openai.com/v1/audio/';
async function request(path, key, body, fetcher = fetch) {
  if (!key?.trim()) throw Error('Dodaj swój klucz OpenAI w ustawieniach powyżej.');
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 90000);
  try {
    const headers = { Authorization: `Bearer ${key.trim()}` };
    if (typeof body === 'string') headers['Content-Type'] = 'application/json';
    const response = await fetcher(endpoint + path, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      const labels = {
        401: 'Klucz API jest nieprawidłowy lub wygasł.',
        403: 'Brak dostępu do wybranego modelu. Wybierz inny model.',
        429: 'Przekroczony limit API lub brak środków na koncie OpenAI.',
        413: 'Plik audio jest za duży.',
      };
      throw Error(
        labels[response.status] ||
          `OpenAI nie przetworzyło żądania (${response.status}). Spróbuj ponownie.`,
      );
    }
    return response;
  } catch (e) {
    if (e.name === 'AbortError')
      throw Error('OpenAI nie odpowiedziało w ciągu 90 sekund. Nagranie jest zapisane lokalnie.');
    if (e instanceof TypeError)
      throw Error(
        'Brak połączenia z OpenAI. Sprawdź internet i czy przeglądarka nie blokuje połączenia.',
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export async function transcribeAudio(blob, key, model = 'gpt-transcribe', fetcher = fetch) {
  if (blob.size > 25 * 1024 * 1024) throw Error('Plik może mieć maksymalnie 25 MB.');
  const form = new FormData();
  form.append('file', blob, 'recording.wav');
  form.append('model', model);
  if (model === 'gpt-transcribe') form.append('languages[]', 'zh');
  else {
    form.append('language', 'zh');
    form.append('response_format', 'json');
  }
  const response = await request('transcriptions', key, form, fetcher);
  const result = await response.json();
  if (typeof result.text !== 'string') throw Error('OpenAI nie zwróciło transkrypcji.');
  return result.text.trim();
}
export async function generateReference(text, key, fetcher = fetch) {
  const response = await request(
    'speech',
    key,
    JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'cedar',
      input: text,
      instructions:
        'Speak only the provided Chinese text in clear Standard Mandarin, with natural Mandarin tones, at a calm teaching pace. Do not add any explanation.',
      response_format: 'mp3',
    }),
    fetcher,
  );
  return response.blob();
}
