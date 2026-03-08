// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  let data = { title: 'תזכורת', body: '', icon: '/favicon.ico', type: 'med' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Badge color based on type
  const isMed = data.type === 'med';
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: isMed ? [200, 100, 200] : [300, 150, 300],
    tag: data.tag || 'default',
    requireInteraction: true,
    dir: 'rtl',
    lang: 'he',
    data: { ...(data.data || {}), type: data.type },
    actions: isMed
      ? [{ action: 'taken', title: '✅ נלקחה' }]
      : [{ action: 'navigate', title: '📍 ניווט' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
