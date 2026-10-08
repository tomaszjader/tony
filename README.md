# Tony — mandaryński w przeglądarce

Aplikacja statyczna bez backendu, Pythona, kont użytkowników i własnych endpointów API. Analiza F0 (YIN), pinyin, frazy, nagrywanie, odtwarzanie i historia działają po stronie przeglądarki. Repozytorium Git ma gałąź `main`; pierwszy commit zachowuje wcześniejszą wersję z backendem.

## GitHub Pages

Adres aplikacji: https://tomaszjader.github.io/tony/

Workflow `.github/workflows/pages.yml` sprawdza formatowanie, uruchamia testy,
buduje aplikację i publikuje `dist/` po każdym pushu do `main`.
W ustawieniach repozytorium **Settings → Pages → Source** wybierz **GitHub Actions**.
Można też uruchomić publikację ręcznie przez **Actions → Deploy GitHub Pages → Run workflow**.
Ścieżki względne w Vite obsługują podkatalog `/tony/`; mikrofon działa przez HTTPS.

## Organizacja projektu

```text
src/
  main.js                 # jedno wejście: style, ćwiczenia i PWA
  features/
    syllables/            # ćwiczenia pojedynczych sylab
    phrases/              # ćwiczenia fraz i porównywanie pinyin
    settings/             # ustawienia i klucz API w pamięci karty
  shared/
    audio/                # dekodowanie, WAV, F0 i worker analizy głosu
    transcription/        # usługa przeglądarki, lokalny Whisper i OpenAI
    storage.js            # wspólny zapis audio w IndexedDB
  pwa/                    # rejestracja i szablon service workera
  styles/
    main.scss             # punkt wejścia stylów
    abstracts/            # kolory, fonty i breakpoint
    base/                 # style globalne i typografia
    layout/               # układ strony i responsywność
    components/           # kontrolki, sylaby, analiza, frazy i historia
tests/
  unit/                   # testy uruchamiane przez npm test
  browser/                # smoke.html i integration.html
public/                   # wzorce MP3, ikona i manifest PWA
scripts/                  # opcjonalne przygotowanie audio
```

`index.html` ładuje `src/main.js`, a `vite.config.js` konfiguruje budowanie.
Moduły w `features/` korzystają ze wspólnych narzędzi w `shared/`. Workery są
przechowywane obok modułów, które je uruchamiają.

## Style SCSS

`src/main.js` importuje `src/styles/main.scss`. Moduły SCSS są łączone przez
`@use`, a wspólne zmienne znajdują się w `src/styles/abstracts/_tokens.scss`.
Style poszczególnych części aplikacji dodawaj w odpowiednich plikach
`styles/components/`; układ strony znajduje się w `styles/layout/`.
Zależność developerska `sass` obsługuje kompilację podczas `npm start` i
`npm run build`. Wynikowy CSS trafia do `dist/assets/`.

Pliki tekstowe mają kodowanie UTF-8. JavaScript używa modułów ES, a formatowanie
JavaScript, HTML, SCSS, JSON i Markdown kontroluje Prettier:

```sh
npm run format
npm run format:check
```

## Uruchamianie aplikacji

```sh
npm install
npm start
```

Otwórz http://localhost:3000. Vite udostępnia wyłącznie pliki i narzędzia developerskie; nie przetwarza audio. Mikrofon wymaga localhost albo HTTPS.

```sh
npm test
npm run build
npm run preview
```

`dist/` zawiera gotowe pliki do dowolnego hostingu statycznego, również GitHub Pages w podkatalogu. Nie otwieraj index.html przez `file://`: moduły, mikrofon i pamięć offline potrzebują HTTP/HTTPS. Produkcyjna wersja ma manifest PWA i service worker: po pierwszym pełnym wczytaniu zachowuje pliki aplikacji i gotowe wzorce do pracy offline. Model Whisper jest pobierany i buforowany osobno.

## Tryby transkrypcji

| Tryb                       | Gdzie analizowane jest audio        | Klucz  | Ograniczenia                                                                                                            |
| -------------------------- | ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Lokalnie, bez transkrypcji | Przeglądarka                        | Nie    | Nagranie, odsłuch, wykres i ręczne porównanie znaków                                                                    |
| Whisper lokalnie           | Web Worker w przeglądarce, WASM     | Nie    | Pierwszy raz pobiera model `Xenova/whisper-tiny` z Hugging Face; może być wolny i mylić mandaryński                     |
| Usługa przeglądarki        | Dostawca rozpoznawania przeglądarki | Nie    | Wyniki na żywo, tylko podczas nowego nagrania; nie działa we wszystkich przeglądarkach i może wysyłać audio do dostawcy |
| OpenAI                     | Bezpośrednio `api.openai.com`       | Własny | Wysyła nagranie; płatne API, internet i uprawnienia do wybranego modelu                                                 |

W ustawieniach można przygotować lokalny Whisper przed nagraniem. Pliki modelu i środowisko WASM są buforowane w przeglądarce; audio nie trafia do Hugging Face. Czyszczenie pamięci przeglądarki usuwa model i lokalne dane. Tryb lokalny działa na CPU przez WASM, bez wymagania WebGPU.

OpenAI domyślnie używa `gpt-transcribe`, z listą języków `zh`; dostępne są także `gpt-4o-mini-transcribe`, `gpt-4o-transcribe` i `whisper-1`. Audio jest konwertowane lokalnie do mono WAV, aby format był zgodny niezależnie od MediaRecorder. W żądaniu nie przekazujemy oczekiwanej frazy jako promptu, żeby nie sugerować rozpoznawania.

## Własny klucz OpenAI

Wklej klucz **w aplikacji**, kliknij „Użyj w tej karcie”, wybierz OpenAI jako tryb transkrypcji. Klucz pozostaje wyłącznie w zmiennej JS: nie zapisujemy go w localStorage, IndexedDB, plikach, logach ani Git. Pole jest czyszczone po zastosowaniu. Odświeżenie karty usuwa klucz; przycisk „Usuń klucz” usuwa go od razu.

BYOK jest opcją do zaufanej osobistej kopii aplikacji. Klucza używanego w przeglądarce nie da się ukryć przed kodem strony ani rozszerzeniami. Nie umieszczaj wspólnego klucza w publicznie hostowanej aplikacji. OpenAI zaleca niewystawianie kluczy w kodzie i repozytorium. Nie dodawaj sekretów do `VITE_*` — trafiłyby do publicznego bundle. `.env*` są ignorowane przez Git.

Klucza nie trzeba przekazywać do czatu. API obciąża konto OpenAI użytkownika. W tej sesji testy żądań używają odpowiedzi zastępczych, bez płatnych wywołań i bez klucza użytkownika.

## Wzorce i nagrania

- Osiem sylab i dwa przykładowe zdania mają dołączone pliki MP3, dostępne bez głosu systemowego.
- Dla własnej frazy dodaj lokalny plik wzorca (np. nagranie nauczyciela) lub wybierz OpenAI do wygenerowania brakującego wzorca. Można też użyć systemowego głosu mandaryńskiego, jeśli jest zainstalowany.
- OpenAI TTS: `gpt-4o-mini-tts`, głos `cedar`, instrukcja wymowy mandaryńskiej. Wysyłany jest tekst frazy, nie nagranie. Głos jest syntetyczny.
- Wzorce i próby są zapisane w IndexedDB; teksty fraz w localStorage. Wyniki pozostają dostępne po odświeżeniu na tym samym originie. Limit nagrania frazy: 20 sekund; import do 8 MB. Wzorzec: do 30 sekund i 8 MB.
- Historia pokazuje 20 najnowszych prób. Nagranie można otworzyć, usunąć, ponownie rozpoznać i pobrać. Próby sylab również zapisują się w historii. Pobierz ważne pliki: pamięć przeglądarki może być czyszczona lub usunięta przez użytkownika.
- Odsłuch ma tempo 1×, 0,8× i 0,6× z zachowaniem wysokości głosu.

## Granice oceny

Ocena pojedynczej sylaby porównuje kształt głosu z uproszczonym wzorcem. Nie mierzy poprawności samogłosek, znaczenia ani wysokiego rejestru tonu 1 bez kalibracji. Porównanie całej frazy pokazuje rozpoznane znaki, ich pinyin i zgodność sylab. Procent nie jest oceną akustyczną tonów; pinyin pochodzi z tekstu. Wykres frazy normalizuje czas i wysokość, bez wyrównania granic sylab i bez sandhi. Wyniki należy zweryfikować na różnych głosach z nauczycielem mandaryńskiego.

## Źródła i narzędzia

- [OpenAI: transkrypcja](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI: generowanie mowy](https://developers.openai.com/api/docs/guides/text-to-speech)
- [OpenAI: ochrona kluczy](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys)
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) i [model Whisper Tiny](https://huggingface.co/Xenova/whisper-tiny)
- [Vite: hosting statyczny](https://vite.dev/guide/static-deploy)

Wzorce dołączone do projektu wygenerowano jednorazowo przez edge-tts, głosem `zh-CN-XiaoxiaoNeural`. Opcjonalny skrypt `scripts/generate_audio.py` służy wyłącznie do przygotowania plików przez autora; aplikacja go nie uruchamia i nie wymaga Pythona.
