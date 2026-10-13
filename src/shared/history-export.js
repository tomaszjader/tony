import { zip, strToU8 } from 'fflate';

function extension(type) {
  const mime = type.split(';')[0].trim().toLowerCase();
  return (
    {
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
    }[mime] || 'bin'
  );
}

export async function exportHistory(attempts, progress, now = new Date()) {
  const files = {};
  const recordings = [];
  for (const [index, attempt] of attempts.entries()) {
    const { blob, ...metadata } = attempt;
    const file = `nagrania/${String(index + 1).padStart(4, '0')}.${extension(blob.type)}`;
    files[file] = new Uint8Array(await blob.arrayBuffer());
    recordings.push({ ...metadata, file, mimeType: blob.type, bytes: blob.size });
  }
  files['historia.json'] = strToU8(
    JSON.stringify({ version: 1, exportedAt: now.toISOString(), recordings, progress }, null, 2),
  );
  files['CZYTAJ.txt'] = strToU8(
    'Tony — kopia historii\n\nFolder nagrania zawiera wszystkie zapisane próby, również starsze niż 20 widocznych w aplikacji.\nPlik historia.json łączy pliki audio z frazami, datami i transkrypcją oraz zawiera zapisany postęp ćwiczeń.\nPunktacja dotyczy kształtu tonu. Starsze nagrania sylab nie mają osobnego wyniku w historii; postęp zawiera dostępne wyniki zbiorcze.\nArchiwum można rozpakować i odsłuchać nagrania. Aplikacja nie obsługuje importu tej kopii.\n',
  );
  const bytes = await new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data))),
  );
  return new Blob([bytes], { type: 'application/zip' });
}
