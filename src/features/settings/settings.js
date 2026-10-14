let apiKey = '';
export function setApiKey(value) {
  apiKey = value.trim();
}
export function getApiKey() {
  return apiKey;
}
export function clearApiKey() {
  apiKey = '';
}
export function initializeSettings() {
  const field = document.getElementById('apiKey'),
    state = document.getElementById('keyStatus'),
    mode = document.getElementById('transcriptionMode'),
    help = document.getElementById('transcriptionHelp');
  const explainMode = () => {
    const explanations = {
      manual:
        'Tylko nagranie, odsłuch i wykres. Audio nie jest wysyłane do usługi transkrypcji; tekst możesz wpisać samodzielnie.',
      whisper:
        'Audio analizuje lokalny Whisper w przeglądarce. Przy pierwszym przygotowaniu pobierze kilkadziesiąt MB modelu; samo nagranie pozostaje na urządzeniu.',
      browser:
        'Rozpoznawanie działa na żywo podczas nowego nagrania. Zależnie od przeglądarki audio może być wysyłane do jej dostawcy.',
      openai:
        'Nagranie jest wysyłane bezpośrednio do OpenAI. Potrzebujesz własnego klucza API; użycie może naliczyć opłatę na Twoim koncie.',
    };
    if (help) help.textContent = explanations[mode.value] || explanations.manual;
  };
  explainMode();
  mode.addEventListener('change', explainMode);
  document.getElementById('useKey').onclick = () => {
    setApiKey(field.value);
    field.value = '';
    state.textContent = apiKey
      ? 'Klucz aktywny w tej karcie. Nie zapisujemy go na dysku.'
      : 'Wklej swój klucz API.';
  };
  document.getElementById('forgetKey').onclick = () => {
    clearApiKey();
    field.value = '';
    state.textContent = 'Klucz usunięty z pamięci tej karty.';
  };
  window.addEventListener('pagehide', () => {
    clearApiKey();
    field.value = '';
    state.textContent = 'Klucz nie jest zapisany. Wpisz go ponownie, aby użyć OpenAI.';
  });
}
