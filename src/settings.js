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
    state = document.getElementById('keyStatus');
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
