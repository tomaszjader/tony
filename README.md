# Tony

Prototyp nauki tonów mandaryńskich w języku polskim.

Uruchom `npm install`, następnie `npm start` i otwórz http://localhost:3000. Testy algorytmów: `npm test`.

## Własne frazy

Sekcja „Twoje frazy” zapisuje chińskie zdania i opcjonalne znaczenia w localStorage tej przeglądarki. Pinyin powstaje automatycznie z pinyin-pro. Wzorzec odtwarza się w tempie 1×, 0,8× lub 0,6×, z zachowaniem wysokości głosu. Tempo dostępne jest także dla pojedynczych sylab.

Nagranie całej frazy (do 20 sekund) lub wybrany plik audio jest rozpoznawany po zakończeniu lokalnie na CPU przez faster-whisper, model small. Wynik zawiera znaki, pinyin, wyrównane porównanie rozpoznanych sylab oraz wykres melodii nagrania i wzorca. Wykres normalizuje czas i wysokość głosu; nie wyrównuje granic sylab. Procent opisuje zgodność rozpoznanego tekstu, nie akustyczną poprawność wymowy ani tonów całego zdania. Model może zwrócić tradycyjne znaki; porównanie używa pinyin. Nie ma transkrypcji na żywo.

Wymagania: Python 3.9+, `python -m pip install --user faster-whisper edge-tts`. Jednorazowo pobierz model: `python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"`. Model jest już przygotowany na tym komputerze. Transkrypcja korzysta z modelu w lokalnej pamięci podręcznej. Tymczasowe nagranie jest usuwane po analizie. Wygenerowane wzorce pozostają w `.cache/`.

Generowanie własnego wzorca wymaga internetu: sam wpisany tekst przesyłany jest do syntezatora Microsoft przez edge-tts. Nagranie użytkownika nie jest wysyłane do zewnętrznej usługi. Serwer działa wyłącznie na 127.0.0.1.

8 sylab, 4 wzorce, gotowe mandaryńskie pliki MP3 (bez instalowania głosu systemowego), nagrywanie do 3 sekund, odsłuch i lokalna analiza F0 metodą YIN. Analiza dopasowuje okno do częstotliwości próbkowania, wybiera ciągły fragment głosu i pokazuje wykres bez punktacji przy niskiej pewności. Nagrania pojedynczych sylab są analizowane wyłącznie w przeglądarce. Google Fonts wymaga internetu; dostępne są fonty zastępcze.

Ocena jest heurystyczna: porównuje kształt przebiegu w półtonach względem mediany głosu, nie rozpoznaje słów, poprawności samogłosek ani absolutnie wysokiego rejestru tonu 1. Wzorce dotyczą izolowanych sylab. Brak sandhi, kalibracji osobniczej i walidacji z nauczycielem. Przed zastosowaniem edukacyjnym należy przetestować różne głosy i mikrofony oraz porównać oceny z ocenami osoby znającej mandaryński.

Pliki `audio/*.mp3` wygenerowano jednorazowo głosem zh-CN-XiaoxiaoNeural przez edge-tts. Odtwarzanie korzysta wyłącznie z lokalnych plików. Opcjonalny skrypt regeneracji: `scripts/generate_audio.py` (wymaga edge-tts i internetu). Są to wzorce syntetyczne, nie nagrania nauczyciela.
