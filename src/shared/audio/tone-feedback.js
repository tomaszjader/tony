// Describe relative pitch movement; absolute vocal register needs calibration.
export function toneSuggestions(points, tone) {
  const average = (from, to) => {
    const section = points.filter((p) => p.x >= from && p.x <= to);
    return section.reduce((sum, p) => sum + p.y, 0) / section.length;
  };
  const start = average(0, 0.2);
  const middle = average(0.4, 0.6);
  const end = average(0.8, 1);
  const suggestions = [];
  if (tone === 1) {
    if (end - start > 0.1)
      suggestions.push('Końcówka idzie w górę. Utrzymaj ją na tej samej wysokości co początek.');
    else if (start - end > 0.1)
      suggestions.push('Końcówka opada. Utrzymaj głos równo aż do końca sylaby.');
    else if (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) > 0.18)
      suggestions.push('Wysokość głosu faluje. Powiedz sylabę płynnie, na jednej wysokości.');
  } else if (tone === 2) {
    if (end - start < 0.3)
      suggestions.push(
        'Wznoszenie jest za małe lub głos opada. Zacznij niżej i zakończ wyraźnie wyżej.',
      );
    if (middle < start - 0.08)
      suggestions.push('W środku głos schodzi w dół. W tym ćwiczeniu prowadź go stopniowo w górę.');
    else if (end - middle < 0.1)
      suggestions.push('Końcówka przestaje się wznosić. Kontynuuj ruch w górę do końca sylaby.');
  } else if (tone === 3) {
    if (start - middle < 0.18)
      suggestions.push('Brakuje wyraźnego zejścia w dół. Obniż głos w środkowej części sylaby.');
    if (end - middle < 0.22)
      suggestions.push(
        'Brakuje powrotu w górę. Po zejściu nisko podnieś głos na końcu tej pojedynczej sylaby.',
      );
    const minimum = points.reduce((lowest, p) => (p.y < lowest.y ? p : lowest), points[0]);
    if (!suggestions.length && (minimum.x < 0.25 || minimum.x > 0.75))
      suggestions.push(
        'Najniższy punkt wypada blisko brzegu sylaby. Spróbuj zejść nisko bliżej jej środka.',
      );
  } else if (tone === 4) {
    if (start - end < 0.35)
      suggestions.push(
        'Spadek jest za mały lub głos rośnie. Zacznij wyżej i zakończ wyraźnie niżej.',
      );
    if (start - middle < 0.15)
      suggestions.push('Opadanie zaczyna się za późno. Obniżaj głos już od początku sylaby.');
    else if (end > middle + 0.08)
      suggestions.push('Końcówka odbija w górę. Zakończ sylabę nisko, bez ponownego wznoszenia.');
  }
  return suggestions.length
    ? suggestions.slice(0, 2)
    : ['Ruch głosu pasuje do tego tonu. Powtórz sylabę i spróbuj utrzymać ten sam przebieg.'];
}
