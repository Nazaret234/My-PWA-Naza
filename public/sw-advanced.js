// Importar Workbox usando importScripts (compatible con Service Workers)
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js'
);

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute, NavigationRoute } = workbox.routing;
const { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } =
  workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// ==================== CONFIGURACIÓN DE CACHÉS ====================

// Nombres de cachés organizados por tipo de recurso
const CACHE_NAMES = {
  // Recursos estáticos (App Shell)
  APP_SHELL: 'app-shell-v1',
  STATIC_RESOURCES: 'static-resources-v1',

  // Recursos dinámicos
  API_DATA: 'api-data-v1',
  IMAGES: 'images-v1',
  FONTS: 'fonts-v1',

  // Páginas y navegación
  PAGES: 'pages-v1',
  OFFLINE_FALLBACK: 'offline-fallback-v1',
};

// URLs y patrones de recursos
const RESOURCE_PATTERNS = {
  // App Shell - recursos críticos para la aplicación
  APP_SHELL: ['/', '/index.html', '/manifest.json'],

  // Recursos estáticos
  STATIC_JS: /\.js$/,
  STATIC_CSS: /\.css$/,
  STATIC_FONTS: /\.(woff|woff2|ttf|eot)$/,

  // Recursos dinámicos
  IMAGES: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  API_ENDPOINTS: /\/api\//,
  FIRESTORE: /firestore\.googleapis\.com/,

  // Fuentes externas
  GOOGLE_FONTS_CSS: /^https:\/\/fonts\.googleapis\.com/,
  GOOGLE_FONTS_FILES: /^https:\/\/fonts\.gstatic\.com/,
};

// ==================== PRECACHING ====================

// Precachear archivos estáticos generados por Workbox
precacheAndRoute(self.__WB_MANIFEST);

// Limpiar cachés obsoletos
cleanupOutdatedCaches();

// ==================== ESTRATEGIAS DE CACHÉ ====================

// 1. CACHE-FIRST para App Shell (HTML, CSS, JS)
// Recursos críticos que cambian poco y necesitan carga rápida
registerRoute(
  ({ request, url }) => {
    // HTML principal
    if (request.mode === 'navigate' && url.pathname === '/') {
      return true;
    }

    // Archivos CSS y JS del bundle principal
    if (
      (request.destination === 'style' || request.destination === 'script') &&
      url.pathname.includes('/assets/')
    ) {
      return true;
    }

    // Manifest y otros recursos del App Shell
    return RESOURCE_PATTERNS.APP_SHELL.some(
      (pattern) => url.pathname === pattern
    );
  },
  new CacheFirst({
    cacheName: CACHE_NAMES.APP_SHELL,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// 2. STALE-WHILE-REVALIDATE para imágenes y datos no críticos
// Muestra contenido del caché inmediatamente y actualiza en background
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.IMAGES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Fuentes de Google - StaleWhileRevalidate
registerRoute(
  RESOURCE_PATTERNS.GOOGLE_FONTS_CSS,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  RESOURCE_PATTERNS.GOOGLE_FONTS_FILES,
  new CacheFirst({
    cacheName: CACHE_NAMES.FONTS,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// 3. NETWORK-FIRST para datos que requieren frescura
// Intenta red primero, caché como fallback para APIs y datos dinámicos
registerRoute(
  ({ url }) => {
    // APIs locales
    if (url.pathname.startsWith('/api/')) {
      return true;
    }

    // Firestore y Firebase
    if (
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase.googleapis.com')
    ) {
      return true;
    }

    // Otros endpoints de datos
    return false;
  },
  new NetworkFirst({
    cacheName: CACHE_NAMES.API_DATA,
    networkTimeoutSeconds: 5, // Timeout de 5 segundos
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 1 día
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// 4. Recursos estáticos adicionales (CSS, JS no críticos)
registerRoute(
  ({ request }) =>
    request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STATIC_RESOURCES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ==================== PÁGINA OFFLINE ====================

// Crear página offline en el caché
const OFFLINE_URL = '/offline.html';

// Precachear la página offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.OFFLINE_FALLBACK).then((cache) => {
      // Crear contenido HTML para la página offline
      const offlineHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sin Conexión - NazaDev</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .offline-container {
            text-align: center;
            max-width: 500px;
            padding: 40px 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .offline-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        h1 { font-size: 2.5rem; margin-bottom: 15px; }
        p { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.9; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            margin: 10px;
            transition: all 0.3s ease;
        }
        .btn:hover {
            background: #45a049;
            transform: translateY(-2px);
        }
        .tips {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            margin-top: 30px;
            text-align: left;
        }
        .tips h3 { text-align: center; margin-bottom: 15px; }
        .tips ul { list-style: none; padding: 0; }
        .tips li { margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📵</div>
        <h1>Sin Conexión</h1>
        <p>No tienes conexión a internet en este momento. Algunas funciones pueden no estar disponibles.</p>
        
        <a href="/" class="btn">🏠 Ir al Inicio</a>
        <button onclick="window.location.reload()" class="btn">🔄 Reintentar</button>
        
        <div class="tips">
            <h3>Mientras tanto puedes:</h3>
            <ul>
                <li>📝 Crear nuevas actividades (se sincronizarán cuando vuelvas a tener conexión)</li>
                <li>👀 Ver actividades guardadas previamente</li>
                <li>📊 Revisar reportes locales</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

      // Guardar la página offline en el caché
      return cache.put(
        OFFLINE_URL,
        new Response(offlineHTML, {
          headers: {
            'Content-Type': 'text/html',
          },
        })
      );
    })
  );
});

// Manejar navegación offline - mostrar página offline para rutas no disponibles
registerRoute(
  new NavigationRoute(
    // Handler que intenta la red primero
    async ({ event }) => {
      try {
        // Intentar obtener la página de la red
        const response = await fetch(event.request);
        return response;
      } catch (error) {
        // Si falla la red, intentar el caché
        const cache = await caches.open(CACHE_NAMES.PAGES);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no hay caché, mostrar página offline
        const offlineCache = await caches.open(CACHE_NAMES.OFFLINE_FALLBACK);
        return offlineCache.match(OFFLINE_URL);
      }
    },
    {
      // Solo aplicar a navegación (no a recursos)
      allowlist: [
        /^(?!.*\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot|ico)).*$/,
      ],
    }
  )
);

// ==================== BACKGROUND SYNC (Código existente) ====================

// Configuración de IndexedDB para cola de sincronización
const SYNC_DB_NAME = 'SyncQueue';
const SYNC_DB_VERSION = 1;
const SYNC_STORE_NAME = 'pendingSync';

// [El resto del código de Background Sync permanece igual...]
// Abrir base de datos de sincronización
async function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
        const store = db.createObjectStore(SYNC_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('tag', 'tag', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Agregar datos a la cola de sincronización
async function addToSyncQueue(tag, data) {
  try {
    const db = await openSyncDB();
    const transaction = db.transaction([SYNC_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SYNC_STORE_NAME);

    const syncData = {
      tag,
      data,
      timestamp: Date.now(),
      attempts: 0,
      maxRetries: 3,
    };

    await store.add(syncData);
    console.log(
      `📝 Datos agregados a cola de sincronización: ${tag}`,
      syncData
    );

    // Registrar Background Sync
    if ('serviceWorker' in self && 'sync' in self.registration) {
      await self.registration.sync.register(tag);
      console.log(`🔄 Background Sync registrado: ${tag}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error al agregar a cola de sincronización:', error);
    return false;
  }
}

// Obtener datos de la cola por tag
async function getSyncQueueByTag(tag) {
  try {
    const db = await openSyncDB();
    const transaction = db.transaction([SYNC_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SYNC_STORE_NAME);
    const index = store.index('tag');

    return new Promise((resolve, reject) => {
      const request = index.getAll(tag);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Error al obtener cola de sincronización:', error);
    return [];
  }
}

// Eliminar datos sincronizados de la cola
async function removeSyncedData(ids) {
  try {
    const db = await openSyncDB();
    const transaction = db.transaction([SYNC_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SYNC_STORE_NAME);

    for (const id of ids) {
      await store.delete(id);
    }

    console.log(
      `🧹 Eliminados ${ids.length} registros sincronizados de la cola`
    );
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar datos sincronizados:', error);
    return false;
  }
}

// Actualizar intentos de sincronización
async function updateSyncAttempts(id, attempts) {
  try {
    const db = await openSyncDB();
    const transaction = db.transaction([SYNC_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SYNC_STORE_NAME);

    const request = store.get(id);
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.attempts = attempts;
        data.lastAttempt = Date.now();
        store.put(data);
      }
    };

    return true;
  } catch (error) {
    console.error('❌ Error al actualizar intentos:', error);
    return false;
  }
}

// Enviar datos a Firestore usando los servicios existentes
async function syncDataToFirestore(syncData) {
  const { tag, data } = syncData;

  try {
    console.log(`🔄 Sincronizando con Firestore: ${tag}`, data);

    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      throw new Error('No hay clientes disponibles para sincronizar');
    }

    const client = clients[0];

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        const { success, result, error } = event.data;
        if (success) {
          console.log(
            `✅ Datos sincronizados exitosamente con Firestore: ${tag}`,
            result
          );
          resolve({ success: true, result });
        } else {
          console.error(`❌ Error al sincronizar con Firestore ${tag}:`, error);
          resolve({ success: false, error });
        }
      };

      client.postMessage(
        {
          type: 'SYNC_TO_FIRESTORE',
          tag,
          data,
        },
        [messageChannel.port2]
      );
    });
  } catch (error) {
    console.error(`❌ Error al sincronizar ${tag}:`, error);
    return { success: false, error: error.message };
  }
}

// Manejador del evento sync
self.addEventListener('sync', async (event) => {
  console.log(`🔄 Evento sync recibido: ${event.tag}`);

  if (event.tag.startsWith('sync-')) {
    event.waitUntil(handleBackgroundSync(event.tag));
  }
});

// Manejar sincronización en background
async function handleBackgroundSync(tag) {
  try {
    console.log(`🔄 Iniciando sincronización en background: ${tag}`);

    const pendingData = await getSyncQueueByTag(tag);

    if (pendingData.length === 0) {
      console.log(`ℹ️ No hay datos pendientes para ${tag}`);
      return;
    }

    console.log(`📊 Sincronizando ${pendingData.length} elementos para ${tag}`);

    const syncedIds = [];
    const failedIds = [];

    for (const syncItem of pendingData) {
      if (syncItem.attempts >= syncItem.maxRetries) {
        console.log(
          `⚠️ Máximo de reintentos alcanzado para item ${syncItem.id}`
        );
        failedIds.push(syncItem.id);
        continue;
      }

      const result = await syncDataToFirestore(syncItem);

      if (result.success) {
        syncedIds.push(syncItem.id);
        console.log(`✅ Item ${syncItem.id} sincronizado exitosamente`);
      } else {
        await updateSyncAttempts(syncItem.id, syncItem.attempts + 1);
        console.log(
          `❌ Falló sincronización de item ${syncItem.id}, intento ${syncItem.attempts + 1}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (syncedIds.length > 0) {
      await removeSyncedData(syncedIds);
    }

    if (failedIds.length > 0) {
      await removeSyncedData(failedIds);
      console.log(
        `🗑️ Eliminados ${failedIds.length} items que excedieron reintentos`
      );
    }

    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        tag,
        syncedCount: syncedIds.length,
        failedCount: failedIds.length,
        totalProcessed: pendingData.length,
      });
    });

    console.log(
      `✅ Sincronización completada para ${tag}: ${syncedIds.length} exitosos, ${failedIds.length} fallidos`
    );
  } catch (error) {
    console.error(`❌ Error en sincronización background para ${tag}:`, error);

    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_ERROR',
        tag,
        error: error.message,
      });
    });
  }
}

// Manejar mensajes desde la aplicación
self.addEventListener('message', async (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'QUEUE_FOR_SYNC':
      const { tag, payload } = data;
      const success = await addToSyncQueue(tag, payload);

      event.ports[0]?.postMessage({
        success,
        message: success
          ? 'Datos agregados a cola de sincronización'
          : 'Error al agregar datos',
      });
      break;

    case 'GET_SYNC_STATUS':
      try {
        const db = await openSyncDB();
        const transaction = db.transaction([SYNC_STORE_NAME], 'readonly');
        const store = transaction.objectStore(SYNC_STORE_NAME);

        const countRequest = store.count();
        countRequest.onsuccess = () => {
          event.ports[0]?.postMessage({
            success: true,
            pendingCount: countRequest.result,
          });
        };
      } catch (error) {
        event.ports[0]?.postMessage({
          success: false,
          error: error.message,
        });
      }
      break;
  }
});

// Notificar cuando hay una nueva versión disponible
self.addEventListener('waiting', (event) => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SW_UPDATE_AVAILABLE',
      });
    });
  });
});

// ==================== NOTIFICACIONES PUSH ====================

// Manejar eventos push de Firebase Cloud Messaging
self.addEventListener('push', (event) => {
  console.log('📱 Evento push recibido:', event);

  if (!event.data) {
    console.warn('⚠️ Evento push sin datos');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('📱 Datos del push:', payload);

    // Extraer información de la notificación
    const { notification, data } = payload;

    if (!notification) {
      console.warn('⚠️ Push sin datos de notificación');
      return;
    }

    const title = notification.title || 'Nueva notificación';
    const options = {
      body: notification.body || '',
      icon: notification.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      image: notification.image,
      data: {
        ...data,
        url: data?.click_action || data?.url || '/',
        timestamp: Date.now(),
      },
      tag: 'fcm-notification',
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
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('❌ Error al procesar evento push:', error);
  }
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Clic en notificación:', event);

  const { action, notification } = event;
  const data = notification.data || {};

  event.notification.close();

  if (action === 'close') {
    console.log('🔔 Notificación cerrada por el usuario');
    return;
  }

  // Determinar URL de destino
  let targetUrl = '/';
  if (action === 'open' || !action) {
    targetUrl = data.url || data.click_action || '/';
  }

  // Abrir o enfocar la aplicación
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar si ya hay una ventana abierta con la app
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // Si encontramos una ventana, la enfocamos y navegamos
            client.focus();
            if (targetUrl !== '/') {
              client.navigate(targetUrl);
            }
            return;
          }
        }

        // Si no hay ventana abierta, abrir una nueva
        return clients.openWindow(targetUrl);
      })
      .catch((error) => {
        console.error('❌ Error al manejar clic de notificación:', error);
      })
  );
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 Notificación cerrada:', event.notification.tag);

  // Aquí puedes agregar analytics o tracking si es necesario
  const data = event.notification.data || {};
  if (data.trackClose) {
    // Enviar evento de tracking
    console.log('📊 Tracking: Notificación cerrada sin interacción');
  }
});

console.log(
  '🚀 Service Worker Avanzado con estrategias de caché optimizadas y notificaciones push cargado correctamente'
);
