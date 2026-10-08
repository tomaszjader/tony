export function SpeechRecognitionClass() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
}
export function startRecognition(onText, onProblem) {
  const Recognition = SpeechRecognitionClass();
  if (!Recognition)
    throw Error(
      'Ta przeglądarka nie udostępnia rozpoznawania mowy. Wybierz OpenAI albo tryb lokalny.',
    );
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  let ended = false,
    latest = '';
  recognition.onresult = (event) => {
    latest = Array.from(event.results, (result) => result[0].transcript).join('');
    onText(latest);
  };
  recognition.onerror = (event) => {
    const errors = {
      'not-allowed': 'Rozpoznawanie mowy nie ma dostępu do mikrofonu.',
      network:
        'Usługa rozpoznawania tej przeglądarki nie odpowiada. Wybierz OpenAI albo tryb lokalny.',
      'service-not-allowed':
        'Ta przeglądarka blokuje usługę rozpoznawania. Wybierz OpenAI albo tryb lokalny.',
      'no-speech': 'Nie rozpoznano mowy.',
    };
    onProblem(errors[event.error] || 'Nie udało się rozpoznać mowy w przeglądarce.');
  };
  let finish;
  const done = new Promise((resolve) => (finish = resolve));
  recognition.onend = () => {
    ended = true;
    finish(latest);
  };
  recognition.start();
  return {
    async stop() {
      if (ended) return latest;
      recognition.stop();
      return Promise.race([
        done,
        new Promise((resolve) => setTimeout(() => resolve(latest), 2500)),
      ]);
    },
    abort() {
      recognition.abort();
    },
  };
}
