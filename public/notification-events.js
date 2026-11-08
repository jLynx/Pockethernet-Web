self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appUrl = new URL('./', self.registration.scope);
      const client = windows.find((window) => window.url.startsWith(appUrl.href));
      if (client) {
        client.postMessage({ type: 'pocketweb-open-results' });
        await client.focus();
      } else {
        await self.clients.openWindow(appUrl.href);
      }
    })(),
  );
});
