import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../../src/features/phrases/phrase-compare.js';
test('identical pinyin matches', () =>
  assert.equal(compare(['nǐ', 'hǎo'], ['nǐ', 'hǎo']).match, 100));
test('an omitted syllable does not misalign the rest', () => {
  const result = compare(['wǒ', 'xiǎng', 'hē', 'chá'], ['wǒ', 'hē', 'chá']);
  assert.deepEqual(result.alignment[1], { expected: 'xiǎng', actual: '' });
  assert.equal(result.match, 75);
});
test('tone differences and extra syllables are visible', () => {
  assert.equal(compare(['mā'], ['mǎ']).match, 0);
  assert.deepEqual(compare(['hǎo'], ['nǐ', 'hǎo']).alignment[0], { expected: '', actual: 'nǐ' });
});
