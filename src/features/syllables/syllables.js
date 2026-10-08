import { target } from '../../shared/audio/pitch.js';
import { analyzeSyllable } from '../../shared/audio/pitch-analysis.js';
import { saveAttempt } from '../../shared/storage.js';
import { download } from '../../shared/audio/audio-utils.js';
let currentRecording = null;
const exercises = [
  ['妈', 'mā', 'mama', 1],
  ['麻', 'má', 'konopie', 2],
  ['马', 'mǎ', 'koń', 3],
  ['骂', 'mà', 'besztać', 4],
  ['衣', 'yī', 'ubranie', 1],
  ['鱼', 'yú', 'ryba', 2],
  ['你', 'nǐ', 'ty', 3],
  ['是', 'shì', 'być / tak', 4],
];
const descriptions = [
  '',
  'Ton 1 · równy i wysoki',
  'Ton 2 · wznoszący',
  'Ton 3 · opadający i wznoszący',
  'Ton 4 · szybko opadający',
];
const tips = [
  '',
  'Utrzymaj głos na jednej wysokości. Wysokiego rejestru nie oceniamy bez kalibracji.',
  'Zacznij niżej i wyraźnie podnieś głos na końcu.',
  'Najpierw obniż głos, a następnie podnieś go pod koniec sylaby.',
  'Zacznij wysoko i zdecydowanie obniż głos.',
];
const referenceAudio = new Audio();
const audioFiles = ['ma1', 'ma2', 'ma3', 'ma4', 'yi1', 'yu2', 'ni3', 'shi4'];
const $ = (id) => document.getElementById(id);
let index = 0,
  recorder,
  stream,
  context,
  timer,
  url,
  busy = false;
referenceAudio.onplay = () => {
  $('reference').textContent = '♫  Odtwarzam wzór…';
};
referenceAudio.onpause = referenceAudio.onended = () => {
  $('reference').textContent = '▷  Odtwórz wzór';
};
window.addEventListener('tony-pause-reference', () => referenceAudio.pause());
$('referenceSpeed').onchange = () => {
  referenceAudio.playbackRate = Number($('referenceSpeed').value);
  referenceAudio.preservesPitch = true;
};
function feedback(title, text) {
  $('resultTitle').textContent = title;
  $('resultText').textContent = text;
}
function draw(points = []) {
  const path = (arr) =>
    arr
      .map(
        (p, i) => `${i ? 'L' : 'M'}${(30 + p.x * 550).toFixed(1)},${(230 - p.y * 200).toFixed(1)}`,
      )
      .join(' ');
  let grid = '';
  for (let i = 0; i < 5; i++)
    grid += `<line x1="30" y1="${30 + i * 50}" x2="580" y2="${30 + i * 50}" stroke="#e7eadf" stroke-dasharray="4 5"/>`;
  const ref = Array.from({ length: 65 }, (_, i) => ({
    x: i / 64,
    y: target(exercises[index][3], i / 64),
  }));
  $('chart').innerHTML =
    grid +
    `<path d="${path(ref)}" fill="none" stroke="#8ba371" stroke-width="4" stroke-linecap="round"/>` +
    (points.length
      ? `<path d="${path(points)}" fill="none" stroke="#df997a" stroke-width="3" stroke-linecap="round"/>`
      : '');
}
function render() {
  currentRecording = null;
  $('downloadSyllable').hidden = true;
  $('syllableSaveStatus').hidden = true;
  $('syllableSaveStatus').textContent = '';
  referenceAudio.pause();
  referenceAudio.currentTime = 0;
  const [char, pinyin, meaning, tone] = exercises[index];
  $('character').textContent = char;
  $('pinyin').textContent = pinyin;
  $('meaning').textContent = meaning;
  $('count').textContent = `${index + 1} z ${exercises.length}`;
  $('description').textContent = descriptions[tone];
  $('tones').innerHTML = [1, 2, 3, 4]
    .map(
      (t) =>
        `<button data-tone="${t}" class="${t === tone ? 'active' : ''}" aria-pressed="${t === tone}">Ton ${t}</button>`,
    )
    .join('');
  $('playback').pause();
  $('playback').hidden = true;
  if (url) {
    URL.revokeObjectURL(url);
    url = null;
  }
  $('playback').removeAttribute('src');
  feedback(
    'Najpierw posłuchaj. Potem spróbuj.',
    'Nagraj swoją wymowę, aby zobaczyć przebieg głosu i otrzymać wskazówkę.',
  );
  draw();
}
function lock(value) {
  busy = value;
  window.dispatchEvent(new CustomEvent('tony-syllable-busy', { detail: value }));
  for (const id of ['next', 'previous', 'reference']) $(id).disabled = value;
  $('tones')
    .querySelectorAll('button')
    .forEach((b) => (b.disabled = value));
}
$('next').onclick = () => {
  index = (index + 1) % exercises.length;
  render();
};
$('previous').onclick = () => {
  index = (index + exercises.length - 1) % exercises.length;
  render();
};
$('tones').onclick = (e) => {
  if (busy) return;
  const t = Number(e.target.dataset.tone);
  if (t) {
    index = exercises.findIndex((a) => a[3] === t);
    render();
  }
};
$('reference').onclick = async () => {
  $('playback').pause();
  referenceAudio.pause();
  referenceAudio.src = `audio/${audioFiles[index]}.mp3`;
  referenceAudio.playbackRate = Number($('referenceSpeed').value);
  referenceAudio.preservesPitch = true;
  try {
    await referenceAudio.play();
  } catch {
    feedback(
      'Nie udało się odtworzyć wzoru',
      'Sprawdź dźwięk w przeglądarce i spróbuj ponownie. Jeśli problem pozostaje, odśwież stronę.',
    );
  }
};
function stop() {
  clearTimeout(timer);
  if (recorder?.state === 'recording') recorder.stop();
}
$('record').onclick = async () => {
  if (recorder?.state === 'recording') {
    stop();
    return;
  }
  if (busy) return;
  lock(true);
  $('record').disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw new Error('Nagrywanie wymaga obsługiwanej przeglądarki i adresu localhost lub HTTPS.');
    referenceAudio.pause();
    $('playback').pause();
    context = new AudioContext();
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    recorder = new MediaRecorder(stream);
    const chunks = [];
    const chosenTone = exercises[index][3];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      $('record').disabled = true;
      $('record').classList.remove('recording');
      $('record').textContent = 'Analizuję…';
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        currentRecording = blob;
        $('downloadSyllable').hidden = false;
        try {
          await saveAttempt({
            id: crypto.randomUUID(),
            date: Date.now(),
            phrase: {
              id: 'syllable-' + index,
              text: exercises[index][0],
              meaning: exercises[index][2],
            },
            blob,
            transcript: '',
            source: 'nagranie sylaby',
          });
          $('syllableSaveStatus').hidden = true;
          $('syllableSaveStatus').textContent = '';
          window.dispatchEvent(new Event('tony-attempt-saved'));
        } catch {
          $('syllableSaveStatus').textContent =
            'Nie zapisano nagrania w historii. Pobierz swoje nagranie przed odświeżeniem strony lub zmianą sylaby.';
          $('syllableSaveStatus').hidden = false;
        }
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        $('playback').src = url;
        $('playback').hidden = false;
        const buffer = await context.decodeAudioData(await blob.arrayBuffer());
        const mono = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const channel = buffer.getChannelData(c);
          for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / buffer.numberOfChannels;
        }
        const result = await analyzeSyllable(mono, buffer.sampleRate, chosenTone);
        draw(result.points);
        if (result.uncertain) {
          feedback(
            'Wykres jest gotowy, ocena jest niepewna',
            'Pokazujemy zmierzony fragment tonu. W nagraniu jest za mało stabilnego głosu, by podać wiarygodny wynik. Spróbuj powiedzieć sylabę płynnie przez około pół sekundy.',
          );
        } else
          feedback(
            `${result.score}/100 · ${result.score >= 75 ? 'Kształt tonu wygląda dobrze' : result.score >= 50 ? 'Dobry początek' : 'Spróbuj jeszcze raz'}`,
            result.score >= 75
              ? 'Twój głos podąża za oczekiwanym przebiegiem. Powtórz ćwiczenie, aby utrwalić ruch głosu.'
              : tips[chosenTone],
          );
      } catch (e) {
        feedback('Powtórz nagranie', e.message);
      } finally {
        await context.close().catch(() => {});
        lock(false);
        $('record').disabled = false;
        $('record').textContent = '●  Nagraj ponownie';
        $('recordNote').textContent = 'Powiedz sylabę raz. Nagranie potrwa do 3 sekund.';
      }
    };
    draw();
    recorder.start();
    $('record').disabled = false;
    $('record').classList.add('recording');
    $('record').textContent = '■  Zakończ nagranie';
    $('recordNote').textContent = 'Nagrywam… powiedz sylabę teraz.';
    feedback('Słucham Twojej wymowy…', 'Powiedz jedną sylabę spokojnie i wyraźnie.');
    timer = setTimeout(stop, 3000);
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    if (context && context.state !== 'closed') await context.close();
    lock(false);
    $('record').disabled = false;
    feedback(
      'Nie udało się uruchomić mikrofonu',
      e.name === 'NotAllowedError'
        ? 'Zezwól na dostęp do mikrofonu w ustawieniach przeglądarki i spróbuj ponownie.'
        : e.message,
    );
  }
};
$('downloadSyllable').onclick = () => {
  if (currentRecording)
    download(
      currentRecording,
      'tony-sylaba.' +
        (currentRecording.type.includes('mp4')
          ? 'm4a'
          : currentRecording.type.includes('ogg')
            ? 'ogg'
            : 'webm'),
    );
};
window.addEventListener('tony-phrase-busy', (e) => {
  for (const id of ['record', 'reference']) $(id).disabled = e.detail;
});
window.addEventListener('pagehide', () => {
  clearTimeout(timer);
  referenceAudio.pause();
  stream?.getTracks().forEach((t) => t.stop());
  if (url) URL.revokeObjectURL(url);
});
render();
