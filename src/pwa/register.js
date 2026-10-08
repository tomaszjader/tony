if (import.meta.env.PROD && 'serviceWorker' in navigator)
  window.addEventListener('load', () =>
    navigator.serviceWorker
      .register(new URL('sw.js', new URL(import.meta.env.BASE_URL, location.href)), {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {}),
  );
