import { pinyin } from 'pinyin-pro';
import { compare } from './phrase-compare.js';
import { analyzeContour } from './pitch-analysis.js';
import { decodeAudio, encodeWav, download } from './audio-utils.js';
import { getApiKey, initializeSettings } from './settings.js';
import { transcribeAudio, generateReference } from './openai-audio.js';
import {
  saveReference,
  loadReference,
  saveAttempt,
  loadAttempts,
  deleteAttempt,
} from './storage.js';
import { startRecognition, SpeechRecognitionClass } from './browser-speech.js';
import { localWhisper, resample16k } from './local-whisper.js';
const $ = (id) => document.getElementById(id),
  ref = new Audio();
const presets = [
  {
    id: 'preset-1',
    text: '你好，我想学习中文。',
    meaning: 'Cześć, chcę uczyć się chińskiego.',
    audio: 'audio/phrase1.mp3',
  },
  {
    id: 'preset-2',
    text: '请给我一杯水。',
    meaning: 'Proszę o szklankę wody.',
    audio: 'audio/phrase2.mp3',
  },
];
let phrases = [],
  selected,
  expected = [],
  recorder,
  stream,
  timer,
  recordURL,
  refURL,
  working = false,
  syllableBusy = false,
  recognition,
  recognitionProblem = '',
  lastAttempt;
try {
  const stored = JSON.parse(localStorage.getItem('tony-phrases') || 'null');
  phrases = Array.isArray(stored)
    ? stored
        .filter((p) => typeof p?.text === 'string' && typeof p?.meaning === 'string')
        .map((p) => ({
          ...p,
          id: p.id || crypto.randomUUID(),
          audio: presets.find((q) => q.text === p.text)?.audio,
        }))
    : presets;
} catch {
  phrases = presets;
}
const toPinyin = (text) => ({
  pinyin: pinyin(text),
  syllables: pinyin(text, { type: 'array', nonZh: 'removed' }),
});
function status(text) {
  $('phraseStatus').textContent = text;
}
async function persistAttempt(attempt) {
  try {
    await saveAttempt(attempt);
    $('phraseSaveStatus').textContent = '';
    $('phraseSaveStatus').hidden = true;
    return true;
  } catch {
    $('phraseSaveStatus').textContent =
      'Nie zapisano nagrania lub zmian w historii. Pobierz WAV przed odświeżeniem strony lub zmianą frazy. Bieżąca transkrypcja może nie być zachowana.';
    $('phraseSaveStatus').hidden = false;
    return false;
  }
}
function savePhrases() {
  try {
    localStorage.setItem('tony-phrases', JSON.stringify(phrases));
  } catch {
    status('Pamięć przeglądarki jest niedostępna. Frazy zostaną tylko w tej karcie.');
  }
}
function lock(value) {
  working = value;
  for (const id of [
    'addPhrase',
    'phraseList',
    'phraseReference',
    'deletePhrase',
    'phraseUpload',
    'referenceUpload',
    'referenceSource',
    'transcriptionMode',
    'transcriptionModel',
    'phraseSpeed',
    'manualApply',
    'prepareWhisper',
  ])
    $(id).disabled = value;
  $('record').disabled = value;
  window.dispatchEvent(new CustomEvent('tony-phrase-busy', { detail: value }));
}
function pauseOthers() {
  ref.pause();
  window.speechSynthesis?.cancel();
  window.dispatchEvent(new Event('tony-pause-reference'));
  $('phrasePlayback').pause();
  $('playback').pause();
}
function recordingBusy() {
  return syllableBusy;
}
function chart(user = [], pattern = []) {
  const path = (points) => {
    let next = true;
    return points
      .map((p) => {
        if (p.y === null) {
          next = true;
          return '';
        }
        const command = next ? 'M' : 'L';
        next = false;
        return `${command}${(20 + p.x * 560).toFixed(1)},${(180 - p.y * 160).toFixed(1)}`;
      })
      .join(' ');
  };
  $('phraseChart').innerHTML =
    [20, 60, 100, 140, 180]
      .map(
        (y) =>
          `<line x1="20" x2="580" y1="${y}" y2="${y}" stroke="#dde2d4" stroke-dasharray="4 5"/>`,
      )
      .join('') +
    `<path d="${path(pattern)}" fill="none" stroke="#8ba371" stroke-width="3"/><path d="${path(user)}" fill="none" stroke="#df997a" stroke-width="2.5"/>`;
}
async function referenceBlob(phrase) {
  const stored = await loadReference(phrase.text).catch(() => null);
  if (stored) return stored;
  if (phrase.audio) {
    const response = await fetch(phrase.audio);
    if (response.ok) return response.blob();
  }
  return null;
}
const analyses = new WeakMap();
function analyzedAudio(blob, decoded) {
  if (!analyses.has(blob)) {
    const job = (async () => {
      const audio = decoded || (await decodeAudio(blob));
      const points = await analyzeContour(audio.samples, audio.rate);
      return { audio, points };
    })().catch((error) => {
      analyses.delete(blob);
      throw error;
    });
    analyses.set(blob, job);
  }
  return analyses.get(blob);
}
async function melody(blob, phrase, decoded) {
  const { points: user } = await analyzedAudio(blob, decoded),
    reference = await referenceBlob(phrase);
  let pattern = [];
  if (reference) {
    try {
      pattern = (await analyzedAudio(reference)).points;
    } catch {}
  }
  chart(user, pattern);
  $('melodyNote').textContent = !user.length
    ? 'Nie udało się zmierzyć melodii. Nagranie możesz odsłuchać.'
    : pattern.length
      ? 'Wzorzec zielony, Twoja wymowa pomarańczowa. Czas i wysokość są przeskalowane. Wykres pokazuje melodię całej frazy, bez oceny poszczególnych tonów.'
      : 'Pomarańczowy wykres pokazuje Twój głos. Dodaj lokalny wzorzec lub wygeneruj go przez OpenAI, aby porównać melodię.';
}
function resetResult() {
  $('phraseSaveStatus').textContent = '';
  $('phraseSaveStatus').hidden = true;
  if (recordURL) {
    URL.revokeObjectURL(recordURL);
    recordURL = null;
  }
  $('phrasePlayback').removeAttribute('src');
  chart();
  $('melodyNote').textContent = 'Po nagraniu zobaczysz przebieg głosu całej frazy.';
  $('recognized').textContent = 'Tutaj pojawi się rozpoznana wypowiedź.';
  $('recognizedPinyin').textContent = '';
  $('phraseComparison').replaceChildren();
  $('phraseScore').textContent = 'Nagraj całą frazę, potem porównaj wynik.';
  $('phrasePlayback').pause();
  $('phrasePlayback').hidden = true;
  $('downloadRecording').disabled = true;
  $('retryTranscription').disabled = true;
  $('manualTranscript').value = '';
  lastAttempt = null;
}
function select(i) {
  if (working || syllableBusy) return;
  pauseOthers();
  selected = phrases[i];
  expected = [];
  resetResult();
  if (!selected) {
    $('phraseText').textContent = 'Dodaj swoją pierwszą frazę';
    $('phrasePinyin').textContent = '';
    $('phraseMeaning').textContent = '';
    return;
  }
  $('phraseList').value = String(i);
  $('phraseText').textContent = selected.text;
  $('phraseMeaning').textContent = selected.meaning;
  const result = toPinyin(selected.text);
  expected = result.syllables;
  $('phrasePinyin').textContent = result.pinyin;
}
function list() {
  const el = $('phraseList');
  el.replaceChildren();
  phrases.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = p.text + (p.meaning ? ` — ${p.meaning}` : '');
    el.append(o);
  });
}
function showTranscript(text, source) {
  const result = toPinyin(text);
  $('recognized').textContent = text || 'Nie rozpoznano mowy.';
  $('recognizedPinyin').textContent = result.pinyin;
  $('phraseComparison').replaceChildren();
  if (!text) {
    $('phraseScore').textContent = 'Brak transkrypcji do porównania.';
    return;
  }
  const assessment = compare(expected, result.syllables);
  $('phraseScore').textContent = `${assessment.match}% zgodności sylab · ${source}`;
  for (const pair of assessment.alignment) {
    const item = document.createElement('div');
    item.className = 'syllable ' + (pair.expected === pair.actual ? 'matched' : 'different');
    const a = document.createElement('strong');
    a.textContent = pair.expected || 'Dodatkowa sylaba';
    const b = document.createElement('span');
    b.textContent = pair.actual || 'Nie rozpoznano';
    item.append(a, b);
    $('phraseComparison').append(item);
  }
}
async function history() {
  const el = $('recordingHistory');
  el.replaceChildren();
  try {
    const attempts = await loadAttempts();
    if (!attempts.length) {
      el.textContent = 'Twoje nagrania pojawią się tutaj.';
      return;
    }
    for (const attempt of attempts.slice(0, 20)) {
      const row = document.createElement('div');
      row.className = 'history-row';
      const label = document.createElement('span');
      label.textContent = `${new Date(attempt.date).toLocaleString('pl-PL')} · ${attempt.phrase.text}`;
      const listen = document.createElement('button');
      listen.textContent = 'Otwórz';
      listen.onclick = async () => {
        if (working || recordingBusy()) return;
        let i = phrases.findIndex((p) => p.text === attempt.phrase.text);
        if (i < 0) {
          phrases.push(attempt.phrase);
          savePhrases();
          list();
          i = phrases.length - 1;
        }
        select(i);
        lastAttempt = attempt;
        setPlayback(attempt.blob);
        showTranscript(attempt.transcript || '', attempt.source || 'zapisana próba');
        try {
          await melody(attempt.blob, selected);
        } catch {}
        status('Otworzono lokalne nagranie. Możesz odsłuchać lub ponownie rozpoznać.');
      };
      const remove = document.createElement('button');
      remove.textContent = 'Usuń nagranie';
      remove.onclick = async () => {
        if (working || syllableBusy) return;
        try {
          await deleteAttempt(attempt.id);
          if (lastAttempt?.id === attempt.id) resetResult();
          await history();
        } catch {
          status('Nie udało się usunąć nagrania z historii. Spróbuj ponownie.');
        }
      };
      row.append(label, listen, remove);
      el.append(row);
    }
  } catch {
    el.textContent = 'Historia jest niedostępna. Nadal możesz pobrać bieżące nagranie.';
  }
}
function setPlayback(blob) {
  if (recordURL) URL.revokeObjectURL(recordURL);
  recordURL = URL.createObjectURL(blob);
  $('phrasePlayback').src = recordURL;
  $('phrasePlayback').hidden = false;
  $('downloadRecording').disabled = false;
  $('retryTranscription').disabled = false;
}
async function recognizeAttempt(attempt, liveText = '') {
  const mode = $('transcriptionMode').value;
  if (mode === 'manual') {
    status('Nagranie i wykres są gotowe. Wybierz OpenAI do rozpoznania albo wpisz tekst ręcznie.');
    return;
  }
  if (mode === 'browser') {
    if (liveText) {
      attempt.transcript = liveText;
      attempt.source = 'rozpoznawanie przeglądarki';
      showTranscript(liveText, attempt.source);
      status('Transkrypcja przeglądarki gotowa. Porównaj sylaby i odsłuchaj tony.');
    } else {
      status(
        recognitionProblem ||
          'Przeglądarka nie zwróciła transkrypcji. OpenAI może rozpoznać zapisane nagranie.',
      );
    }
    return;
  }
  if (mode === 'whisper') {
    const { audio, points } = await analyzedAudio(attempt.blob);
    if (!points.length) {
      status('Nie wykryto stabilnego głosu. Sprawdź odsłuch nagrania.');
      return;
    }
    status('Uruchamiam lokalny Whisper. Pierwsze użycie wymaga pobrania modelu…');
    const text = await localWhisper(resample16k(audio.samples, audio.rate), status);
    attempt.transcript = text;
    attempt.source = 'Whisper w przeglądarce';
    showTranscript(text, attempt.source);
    status('Lokalna transkrypcja gotowa. Model tiny może mylić słowa; porównaj wynik z odsłuchem.');
    return;
  }
  status('Wysyłam nagranie bezpośrednio do OpenAI…');
  const text = await transcribeAudio(attempt.blob, getApiKey(), $('transcriptionModel').value);
  attempt.transcript = text;
  attempt.source = 'OpenAI';
  showTranscript(text, attempt.source);
  status(
    text
      ? 'Transkrypcja gotowa. Procent opisuje zgodność sylab, nie poprawność wszystkich tonów.'
      : 'OpenAI nie rozpoznało wypowiedzi. Odsłuchaj nagranie i spróbuj ponownie.',
  );
}
async function evaluate(blob, liveText = '') {
  lock(true);
  $('phraseRecord').disabled = true;
  resetResult();
  try {
    status('Analizuję nagranie lokalnie…');
    const audio = await decodeAudio(blob);
    if (audio.duration > 21) throw Error('Wybierz nagranie do 20 sekund.');
    const wav = encodeWav(audio.samples, audio.rate);
    const attempt = {
      id: crypto.randomUUID(),
      date: Date.now(),
      phrase: { ...selected },
      blob: wav,
      transcript: '',
      source: '',
    };
    lastAttempt = attempt;
    setPlayback(wav);
    await persistAttempt(attempt);
    await melody(wav, selected, audio);
    await recognizeAttempt(attempt, liveText);
    await persistAttempt(attempt);
  } catch (e) {
    status(e.message);
  } finally {
    lock(false);
    $('phraseRecord').disabled = false;
    history();
  }
}
$('phraseForm').onsubmit = (e) => {
  e.preventDefault();
  if (working || syllableBusy) return;
  const text = $('newPhrase').value.trim(),
    meaning = $('newMeaning').value.trim();
  if (!/\p{Script=Han}/u.test(text)) {
    status('Wpisz frazę chińskimi znakami. Pinyin pojawi się automatycznie.');
    return;
  }
  phrases.push({ id: crypto.randomUUID(), text, meaning });
  savePhrases();
  list();
  select(phrases.length - 1);
  $('phraseForm').reset();
  status('Fraza zapisana lokalnie. Dodaj wzorzec audio lub wygeneruj go przez OpenAI.');
};
$('phraseList').onchange = (e) => select(Number(e.target.value));
$('deletePhrase').onclick = () => {
  if (!selected || working || syllableBusy) return;
  phrases.splice(phrases.indexOf(selected), 1);
  savePhrases();
  list();
  select(0);
};
$('phraseSpeed').onchange = () => {
  ref.playbackRate = Number($('phraseSpeed').value);
  ref.preservesPitch = true;
};
$('phraseReference').onclick = async () => {
  if (working || recordingBusy()) return;
  if (!selected) {
    status('Najpierw dodaj frazę.');
    return;
  }
  pauseOthers();
  lock(true);
  $('phraseRecord').disabled = true;
  try {
    let blob = await referenceBlob(selected);
    const source = $('referenceSource').value;
    if (source === 'openai' && !blob) {
      status('Generuję wzór przez OpenAI. Wysyłam tylko tekst frazy…');
      blob = await generateReference(selected.text, getApiKey());
      await saveReference(selected.text, blob).catch(() => {});
    }
    if (source === 'system' && !blob) {
      const voices = window.speechSynthesis?.getVoices() || [],
        voice = voices.find((v) => /^zh[-_]CN/i.test(v.lang));
      if (!voice)
        throw Error('Brak głosu mandaryńskiego w systemie. Dodaj plik wzorca lub wybierz OpenAI.');
      const utterance = new SpeechSynthesisUtterance(selected.text);
      utterance.voice = voice;
      utterance.lang = 'zh-CN';
      utterance.rate = Number($('phraseSpeed').value);
      window.speechSynthesis.speak(utterance);
      status('Odtwarzam syntetyczny głos systemowy.');
      return;
    }
    if (!blob)
      throw Error(
        'Dla tej frazy nie ma lokalnego wzorca. Dodaj plik audio poniżej lub wybierz wzorzec OpenAI.',
      );
    if (refURL) URL.revokeObjectURL(refURL);
    refURL = URL.createObjectURL(blob);
    ref.src = refURL;
    ref.playbackRate = Number($('phraseSpeed').value);
    ref.preservesPitch = true;
    await ref.play();
    status('Odtwarzam zapisany wzór. Zmiana tempa nie zmienia wysokości głosu.');
  } catch (e) {
    status(e.message);
  } finally {
    lock(false);
    $('phraseRecord').disabled = false;
  }
};
$('phraseStopReference').onclick = () => {
  ref.pause();
  ref.currentTime = 0;
  window.speechSynthesis?.cancel();
};
$('referenceUpload').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || working || !selected || recordingBusy()) return;
  lock(true);
  try {
    if (file.size > 8 * 1024 * 1024) throw Error('Wzorzec może mieć maksymalnie 8 MB.');
    const audio = await decodeAudio(file);
    if (audio.duration > 30) throw Error('Wzorzec może trwać maksymalnie 30 sekund.');
    await saveReference(selected.text, file);
    status('Wzorzec zapisany lokalnie. Możesz go odtwarzać również bez internetu.');
  } catch (e) {
    status(e.message);
  } finally {
    lock(false);
  }
};
function stop() {
  clearTimeout(timer);
  if (recorder?.state === 'recording') recorder.stop();
}
$('phraseRecord').onclick = async () => {
  if (recorder?.state === 'recording') {
    stop();
    return;
  }
  if (working) return;
  if (!selected || !expected.length) {
    status('Najpierw wybierz frazę.');
    return;
  }
  if (recordingBusy()) {
    status('Zakończ nagranie pojedynczej sylaby.');
    return;
  }
  if ($('transcriptionMode').value === 'openai' && !getApiKey()) {
    status('Dodaj swój klucz w ustawieniach lub wybierz tryb lokalny.');
    return;
  }
  lock(true);
  $('phraseRecord').disabled = true;
  pauseOthers();
  recognitionProblem = '';
  recognition = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw Error('Mikrofon wymaga HTTPS lub localhost i obsługiwanej przeglądarki.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    const parts = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    if ($('transcriptionMode').value === 'browser') {
      try {
        recognition = startRecognition(
          (text) => {
            $('recognized').textContent = text;
            $('recognizedPinyin').textContent = pinyin(text);
          },
          (text) => {
            recognitionProblem = text;
            status(text);
          },
        );
      } catch (e) {
        recognitionProblem = e.message;
      }
    }
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      $('phraseRecord').disabled = true;
      $('phraseRecord').classList.remove('recording');
      $('phraseRecord').textContent = '● Nagraj całą frazę';
      const text = recognition ? await recognition.stop() : '';
      evaluate(new Blob(parts, { type: recorder.mimeType }), text);
    };
    recorder.start();
    $('phraseRecord').disabled = false;
    $('phraseRecord').classList.add('recording');
    $('phraseRecord').textContent = '■ Zakończ nagranie';
    status(
      recognitionProblem || 'Nagrywam do 20 sekund. Kliknij zakończenie, gdy powiesz całą frazę.',
    );
    timer = setTimeout(stop, 20000);
  } catch (e) {
    recognition?.abort();
    stream?.getTracks().forEach((t) => t.stop());
    lock(false);
    $('phraseRecord').disabled = false;
    status(
      e.name === 'NotAllowedError'
        ? 'Zezwól na dostęp do mikrofonu w ustawieniach przeglądarki.'
        : e.message,
    );
  }
};
$('phraseUpload').onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || working) return;
  if (recordingBusy()) {
    status('Zakończ nagranie sylaby.');
    return;
  }
  if (!selected) {
    status('Najpierw wybierz frazę.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    status('Nagranie może mieć maksymalnie 8 MB.');
    return;
  }
  pauseOthers();
  evaluate(file);
};
$('downloadRecording').onclick = () => {
  if (lastAttempt) download(lastAttempt.blob, `tony-${lastAttempt.id.slice(0, 8)}.wav`);
};
$('retryTranscription').onclick = async () => {
  if (!lastAttempt || working || syllableBusy) return;
  if ($('transcriptionMode').value === 'browser') {
    status(
      'Rozpoznawanie przeglądarki działa podczas nowego nagrania. Do zapisanego pliku wybierz OpenAI.',
    );
    return;
  }
  lock(true);
  $('phraseRecord').disabled = true;
  try {
    await recognizeAttempt(lastAttempt);
    await persistAttempt(lastAttempt);
  } catch (e) {
    status(e.message);
  } finally {
    lock(false);
    $('phraseRecord').disabled = false;
    history();
  }
};
$('manualApply').onclick = async () => {
  const text = $('manualTranscript').value.trim();
  if (!text || working || syllableBusy) return;
  if (!/\p{Script=Han}/u.test(text)) {
    status('Wpisz transkrypcję chińskimi znakami.');
    return;
  }
  showTranscript(text, 'tekst wpisany ręcznie');
  if (lastAttempt) {
    lastAttempt.transcript = text;
    lastAttempt.source = 'tekst wpisany ręcznie';
    await persistAttempt(lastAttempt);
  }
  status('Porównanie wpisanego tekstu gotowe. Ten tryb nie rozpoznaje nagrania automatycznie.');
};
$('transcriptionMode').onchange = () => {
  const mode = $('transcriptionMode').value;
  status(
    mode === 'openai'
      ? 'OpenAI: nagranie zostanie wysłane bezpośrednio do API. Naliczane są opłaty na Twoim koncie.'
      : mode === 'browser'
        ? 'Usługa przeglądarki może wysyłać mowę do jej dostawcy; dostępność zależy od przeglądarki.'
        : 'Tryb lokalny: nagrywanie, wykresy i odsłuch bez wysyłania audio.',
  );
};
$('prepareWhisper').onclick = async () => {
  if (working || recordingBusy()) return;
  lock(true);
  $('phraseRecord').disabled = true;
  try {
    status('Przygotowuję lokalny model. Pobieramy pliki z Hugging Face; audio nie jest wysyłane.');
    await localWhisper(null, status);
    status('Lokalny Whisper jest gotowy. Wybierz go jako tryb transkrypcji.');
  } catch (e) {
    status(e.message);
  } finally {
    lock(false);
    $('phraseRecord').disabled = false;
  }
};
window.addEventListener('tony-syllable-busy', (e) => {
  syllableBusy = e.detail;
  for (const id of [
    'phraseRecord',
    'phraseReference',
    'referenceUpload',
    'phraseUpload',
    'phraseList',
    'deletePhrase',
    'addPhrase',
    'prepareWhisper',
    'manualApply',
  ])
    $(id).disabled = syllableBusy || working;
  $('retryTranscription').disabled = syllableBusy || working || !lastAttempt;
});
window.addEventListener('pagehide', () => {
  clearTimeout(timer);
  recognition?.abort();
  stream?.getTracks().forEach((t) => t.stop());
  ref.pause();
  window.speechSynthesis?.cancel();
  if (recordURL) URL.revokeObjectURL(recordURL);
  if (refURL) URL.revokeObjectURL(refURL);
});
window.addEventListener('tony-attempt-saved', () => history());
if (!SpeechRecognitionClass()) $('browserSpeechOption').disabled = true;
initializeSettings();
list();
select(0);
history();
