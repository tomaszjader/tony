import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const audio = resolve('public/audio/phrase1.mp3');

test('historical difficult syllables and weekly results survive reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('tony-progress')) return;
    const date = new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    localStorage.setItem(
      'tony-progress',
      JSON.stringify({
        exercises: {
          1: { last: 95, best: 95, count: 3, recent: [30, 40, 95] },
          3: { last: 90, best: 90, count: 1, recent: [90] },
        },
        sessions: [],
        days: { [key]: { count: 4, total: 255 } },
      }),
    );
  });
  await page.goto('/');
  await page.getByText('Postęp z ostatniego tygodnia', { exact: true }).click();
  await expect(page.locator('#weeklySummary')).toContainText('4 ocenionych prób');
  await expect(page.locator('#weeklyProgress li')).toHaveCount(7);
  await page.locator('#reviewDifficult').click();
  await expect(page.locator('#pinyin')).toHaveText('má');
  await expect(page.locator('#trainingResults li')).toHaveCount(5);
  await expect(page.locator('#trainingResults')).not.toContainText('mà');
  await page.reload();
  await expect(page.locator('#reviewDifficult')).toBeVisible();
  await page.getByText('Postęp z ostatniego tygodnia', { exact: true }).click();
  await expect(page.locator('#weeklySummary')).toContainText('4 ocenionych prób');
});

async function importRecording(page) {
  await page.locator('#phraseUpload').setInputFiles(audio);
  await expect(page.locator('#recordingHistory .history-row')).toHaveCount(1);
  await expect(page.locator('#phraseUpload')).toBeEnabled();
  await expect(page.locator('#phrasePlayback')).toBeVisible();
  await expect(page.locator('#phraseChart path').last()).toHaveAttribute('d', /M.+L/);
}

test('import audio, compare text, reopen history and delete recording', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await importRecording(page);
  await page.locator('#manualTranscript').fill('你好，我想学习中文。');
  await page.locator('#manualApply').click();
  await expect(page.locator('#phraseStatus')).toContainText('Porównanie wpisanego tekstu gotowe');
  await expect(page.locator('#phraseScore')).toContainText('100%');
  await page.reload();
  await expect(page.locator('#recordingHistory .history-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Otwórz', exact: true }).click();
  await expect(page.locator('#recognized')).toHaveText('你好，我想学习中文。');
  await expect(page.locator('#phraseStatus')).toContainText('Otworzono lokalne nagranie');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadRecording').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^tony-.*\.wav$/);
  expect(await download.failure()).toBeNull();
  await page.getByRole('button', { name: 'Usuń nagranie', exact: true }).click();
  await expect(page.locator('#recordingHistory .history-row')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#recordingHistory')).toContainText('Twoje nagrania pojawią się tutaj');
  expect(errors).toEqual([]);
});

test('production app, reference audio and pitch worker work offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#pinyin')).toHaveText('mā');
  await page.locator('#phraseReference').click();
  await expect(page.locator('#phraseStatus')).toContainText('Odtwarzam zapisany wzór');
  await page.locator('#phraseStopReference').click();
  await importRecording(page);
  await expect(page.locator('#melodyNote')).toContainText('Wzorzec zielony');
  await page.reload();
  await page.getByRole('button', { name: 'Otwórz', exact: true }).click();
  await expect(page.locator('#phraseStatus')).toContainText('Otworzono lokalne nagranie');
});
