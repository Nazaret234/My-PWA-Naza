// Firebase Messaging Service Worker
// Este archivo debe estar en la raíz del dominio (public/) para que Firebase pueda acceder a él

// Importar Firebase scripts
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
);

// Configuración de Firebase
// IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyCiXHdURfywhWqnzw_bNZLhr1E6i4Bfmnc',
  authDomain: 'my-pwa-jnlr.firebaseapp.com',
  projectId: 'my-pwa-jnlr',
  storageBucket: 'my-pwa-jnlr.firebasestorage.app',
  messagingSenderId: '857964538265',
  appId: '1:857964538265:web:b6bfec28e85fa2a5a3cb08',
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener instancia de messaging
const messaging = firebase.messaging();

// Manejar mensajes en background
messaging.onBackgroundMessage((payload) => {
  console.log('📱 Mensaje en background recibido');

  const { notification, data } = payload;

  if (!notification) {
    console.warn('⚠️ Mensaje sin datos de notificación');
    return;
  }

  const notificationTitle = notification.title || 'Nueva notificación';
  const notificationOptions = {
    body: notification.body || '',
    icon: notification.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: notification.image,
    data: {
      ...data,
      url: data?.click_action || data?.url || '/',
      timestamp: Date.now(),
    },
    tag: 'fcm-background-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/icons/icon-32x32.png',
      },
      {
        action: 'close',
        title: 'Cerrar',
      },
    ],
  };

  // Mostrar la notificación
  self.registration.showNotification(notificationTitle, notificationOptions);
});

console.log('🔥 Firebase Messaging Service Worker cargado correctamente');
