import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress,
  recordProgress,
  trainingQueue,
  weeklyProgress,
  readProgress,
} from '../../src/features/syllables/training.js';

test('review uses recent history rather than one lucky attempt', () => {
  const progress = emptyProgress();
  for (const score of [30, 35, 100]) recordProgress(progress, 0, score);
  recordProgress(progress, 1, 65);
  assert.deepEqual(trainingQueue(progress, [1, 2], [0, 1]), [0, 1, 0, 1, 0]);
  for (let i = 0; i < 5; i++) recordProgress(progress, 0, 90);
  assert.deepEqual(trainingQueue(progress, [1, 2], [0, 1]), [1, 0, 1, 0, 1]);
});

test('weekly summary includes free practice and crosses month boundaries', () => {
  const progress = emptyProgress();
  recordProgress(progress, 0, 40, new Date(2026, 8, 30, 23));
  recordProgress(progress, 0, 80, new Date(2026, 8, 30, 23));
  recordProgress(progress, 1, 90, new Date(2026, 9, 6));
  recordProgress(progress, 1, 10, new Date(2026, 8, 29));
  const week = weeklyProgress(progress, new Date(2026, 9, 6));
  assert.equal(week.length, 7);
  assert.equal(week[0].key, '2026-09-30');
  assert.equal(week[0].average, 60);
  assert.equal(week[1].average, null);
  assert.equal(
    week.reduce((sum, day) => sum + day.count, 0),
    3,
  );
});

test('old progress is preserved without inventing dated attempts', () => {
  const progress = readProgress({
    getItem: () =>
      JSON.stringify({ exercises: { 0: { last: 60, best: 80, count: 3 } }, sessions: [] }),
  });
  assert.equal(progress.exercises[0].count, 3);
  assert.deepEqual(progress.exercises[0].recent, [60]);
  assert.deepEqual(progress.days, {});
});
