// Écouteurs push/notificationclick, injectés dans le service worker généré
// par vite-plugin-pwa via workbox.importScripts (voir vite.config.js) —
// évite de passer en stratégie injectManifest juste pour ces deux écouteurs.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* payload non-JSON, ignoré */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CaloriesTracker', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/today' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/today'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c)
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
