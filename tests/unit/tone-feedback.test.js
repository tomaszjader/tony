import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toneSuggestions } from '../../src/shared/audio/tone-feedback.js';
import { target } from '../../src/shared/audio/pitch.js';

const contour = (fn) => Array.from({ length: 101 }, (_, i) => ({ x: i / 100, y: fn(i / 100) }));

test('matching contours encourage repeating all four tones', () => {
  for (const tone of [1, 2, 3, 4])
    assert.match(
      toneSuggestions(
        contour((x) => target(tone, x)),
        tone,
      )[0],
      /pasuje/,
    );
});

test('suggestions identify falling level tone and missing rising movement', () => {
  assert.match(
    toneSuggestions(
      contour((x) => 0.8 - x * 0.4),
      1,
    )[0],
    /opada/,
  );
  assert.match(
    toneSuggestions(
      contour(() => 0.5),
      2,
    )[0],
    /Wznoszenie/,
  );
  assert.match(
    toneSuggestions(
      contour(() => 0.5),
      4,
    )[0],
    /Spadek/,
  );
});

test('third tone distinguishes missing dip from missing recovery', () => {
  assert.match(
    toneSuggestions(
      contour((x) => 0.2 + x * 0.6),
      3,
    )[0],
    /zejścia/,
  );
  assert.match(
    toneSuggestions(
      contour((x) => 0.8 - x * 0.6),
      3,
    )[0],
    /powrotu/,
  );
});
