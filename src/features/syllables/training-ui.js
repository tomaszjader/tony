import {
  readProgress, emptyProgress, recordProgress, trainingQueue, createSession,
  acceptResult, advanceSession, sessionSummary,
} from './training.js';

export function setupTraining(exercises, selectExercise) {
  const $ = (id) => document.getElementById(id);
  let progress;
  try { progress = readProgress(window.localStorage); }
  catch { progress = emptyProgress(); }
  let session = null;
  let locked = false;
  const active = () => session && !session.complete;

  function persist() {
    try {
      localStorage.setItem('tony-progress', JSON.stringify(progress));
      $('progressSaveStatus').hidden = true;
    } catch {
      $('progressSaveStatus').textContent = 'Postęp jest dostępny tylko w tej karcie. Nie udało się zapisać go w przeglądarce.';
      $('progressSaveStatus').hidden = false;
    }
  }

  function refresh() {
    const running = active();
    $('startTraining').hidden = !!running;
    $('nextTraining').hidden = !running;
    $('stopTraining').hidden = !running;
    $('trainingProgress').hidden = !session;
    $('trainingResults').hidden = !session;
    $('repeatTraining').hidden = !session?.complete || !sessionSummary(session).difficult.length;
    for (const id of ['startTraining', 'stopTraining', 'repeatTraining']) $(id).disabled = locked;
    $('nextTraining').disabled = locked || !running || session.results[session.position] === null;
    $('next').disabled = $('previous').disabled = locked || !!running;
    $('tones').querySelectorAll('button').forEach((button) => button.disabled = locked || !!running);
    if (session) {
      const completed = session.results.filter((score) => score !== null).length;
      $('trainingProgress').value = completed;
      $('trainingResults').replaceChildren();
      session.queue.forEach((id, step) => {
        const item = document.createElement('li');
        const score = session.results[step];
        item.textContent = `${exercises[id][1]} · ${score === null ? 'jeszcze przed Tobą' : `${score}/100 pkt`}`;
        if (running && step === session.position) item.setAttribute('aria-current', 'step');
        $('trainingResults').append(item);
      });
      if (running) {
        const ready = session.results[session.position] !== null;
        $('trainingStatus').textContent = `Ćwiczenie ${session.position + 1} z 5 · ${exercises[session.queue[session.position]][1]}. ${ready ? 'Możesz poprawić tę próbę lub przejść dalej.' : 'Posłuchaj wzorca i nagraj sylabę. Do przejścia dalej potrzebny jest pewny wynik.'}`;
        $('nextTraining').textContent = session.position === 4 ? 'Zobacz podsumowanie' : 'Następne ćwiczenie';
      } else {
        const { average, difficult } = sessionSummary(session);
        $('trainingStatus').textContent = `Sesja ukończona · średnio ${average}/100 pkt. ${difficult.length ? 'Wróć do sylab z wynikiem poniżej 75 punktów.' : 'Wszystkie próby mają co najmniej 75 punktów. Spróbuj kolejnej sesji.'}`;
      }
    }
    const count = Object.values(progress.exercises).reduce((sum, entry) => sum + entry.count, 0);
    const recent = progress.sessions.slice(-3).map((entry) => `${entry.average} pkt`).join(' → ');
    $('trainingTotals').textContent = count
      ? `Ocenione próby: ${count}. ${recent ? `Ostatnie sesje (średnia): ${recent}.` : 'Ukończ sesję, aby zobaczyć jej średni wynik.'} Postęp zapisujemy w tej przeglądarce.`
      : 'Wyniki zaczną się zapisywać po pierwszej ocenionej próbie.';
  }

  function start(preferred = []) {
    if (locked) return;
    session = createSession(trainingQueue(progress, exercises.map((exercise) => exercise[3]), preferred));
    selectExercise(session.queue[0]);
    refresh();
    $('reference').focus();
  }
  $('startTraining').onclick = () => start();
  $('repeatTraining').onclick = () => {
    if (session?.complete) start(sessionSummary(session).difficult);
  };
  $('nextTraining').onclick = () => {
    if (locked || !advanceSession(session)) return;
    if (session.complete) {
      progress.sessions.push({ date: Date.now(), average: sessionSummary(session).average });
      progress.sessions = progress.sessions.slice(-20);
      persist();
    } else {
      selectExercise(session.queue[session.position]);
      $('reference').focus();
    }
    refresh();
  };
  $('stopTraining').onclick = () => {
    if (locked) return;
    session = null;
    $('trainingStatus').textContent = 'Sesja zakończona. Wyniki ocenionych prób zachowano. Możesz ćwiczyć swobodnie lub rozpocząć nową sesję.';
    refresh();
  };

  return {
    active,
    refresh,
    setLocked(value) { locked = value; refresh(); },
    result(id, result) {
      if (result.uncertain) return;
      const difference = recordProgress(progress, id, result.score);
      const entry = progress.exercises[id];
      $('scoreChange').textContent = difference === null
        ? `Pierwsza oceniona próba tej sylaby. Najlepszy wynik: ${entry.best} pkt.`
        : `Względem poprzedniej próby: ${difference > 0 ? '+' : ''}${difference} pkt. Najlepszy wynik: ${entry.best} pkt · próby: ${entry.count}.`;
      if (active() && session.queue[session.position] === id) acceptResult(session, result);
      persist();
      refresh();
    },
  };
}
