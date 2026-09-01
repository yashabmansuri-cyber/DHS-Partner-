importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  "apiKey": "AIzaSyDySwVvKkMdVDfQZEWO4wPl7tPThrlmnqQ",
  "authDomain": "dhs-delhi-home-service.firebaseapp.com",
  "projectId": "dhs-delhi-home-service",
  "storageBucket": "dhs-delhi-home-service.firebasestorage.app",
  "messagingSenderId": "729497010980",
  "appId": "1:729497010980:web:c861571c0192464fb329b1",
  "measurementId": "G-7FJ4PVLR4Z"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const n = payload.notification || {};
  const title = n.title || data.title || 'DHS – New Booking';
  const body = n.body || data.body || 'New booking has been assigned to you.';
  const bookingId = data.bookingId || data.bookingid || data.bookingID || '';
  self.registration.showNotification(title, {
    body,
    icon: './images/dhs-icon-192.png',
    badge: './images/dhs-icon-192.png',
    vibrate: [500, 120, 500, 120, 900, 150, 700],
    tag: bookingId ? `dhs-booking-${bookingId}` : 'dhs-booking',
    renotify: true,
    requireInteraction: true,
    silent: false,
    actions: bookingId ? [
      { action: 'accept', title: 'Accept' },
      { action: 'reject', title: 'Reject' }
    ] : [],
    data: { ...data, bookingId, url: './index.html' }
  });
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const d = n.data || {};
  n.close();
  const action = event.action || '';
  const bookingId = d.bookingId || '';
  const qs = bookingId && (action === 'accept' || action === 'reject') ? `?bookingId=${encodeURIComponent(bookingId)}&action=${encodeURIComponent(action)}` : '';
  const url = (d.url || './index.html') + qs;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        try { return client.navigate(url).then(()=>client.focus()); } catch(e) { return client.focus(); }
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
