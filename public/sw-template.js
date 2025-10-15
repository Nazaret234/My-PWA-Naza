import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

// Precachear archivos estáticos
precacheAndRoute(self.__WB_MANIFEST);

// Limpiar cachés obsoletos
cleanupOutdatedCaches();

// Estrategia para navegación (App Shell)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'pages',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          return `${request.url}?timestamp=${Date.now()}`;
        },
      },
    ],
  })
);

// Estrategia para recursos estáticos
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Estrategia para imágenes
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      {
        cacheExpiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    ],
  })
);

// ==================== BACKGROUND SYNC API ====================

// Configuración de IndexedDB para cola de sincronización
const SYNC_DB_NAME = 'SyncQueue';
const SYNC_DB_VERSION = 1;
const SYNC_STORE_NAME = 'pendingSync';

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

    // Importar dinámicamente los servicios (solo disponibles en el contexto principal)
    // En el Service Worker, necesitamos comunicarnos con la aplicación principal
    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      throw new Error('No hay clientes disponibles para sincronizar');
    }

    // Enviar mensaje al cliente principal para que maneje la sincronización
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

      // Enviar datos al cliente principal para sincronización
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

    // Obtener datos pendientes de sincronización
    const pendingData = await getSyncQueueByTag(tag);

    if (pendingData.length === 0) {
      console.log(`ℹ️ No hay datos pendientes para ${tag}`);
      return;
    }

    console.log(`📊 Sincronizando ${pendingData.length} elementos para ${tag}`);

    const syncedIds = [];
    const failedIds = [];

    // Procesar cada elemento pendiente
    for (const syncItem of pendingData) {
      // Verificar si ya se excedieron los reintentos
      if (syncItem.attempts >= syncItem.maxRetries) {
        console.log(
          `⚠️ Máximo de reintentos alcanzado para item ${syncItem.id}`
        );
        failedIds.push(syncItem.id);
        continue;
      }

      // Intentar sincronizar
      const result = await syncDataToFirestore(syncItem);

      if (result.success) {
        syncedIds.push(syncItem.id);
        console.log(`✅ Item ${syncItem.id} sincronizado exitosamente`);
      } else {
        // Incrementar contador de intentos
        await updateSyncAttempts(syncItem.id, syncItem.attempts + 1);
        console.log(
          `❌ Falló sincronización de item ${syncItem.id}, intento ${syncItem.attempts + 1}`
        );
      }

      // Pausa pequeña entre requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Eliminar datos sincronizados exitosamente
    if (syncedIds.length > 0) {
      await removeSyncedData(syncedIds);
    }

    // Eliminar datos que excedieron reintentos
    if (failedIds.length > 0) {
      await removeSyncedData(failedIds);
      console.log(
        `🗑️ Eliminados ${failedIds.length} items que excedieron reintentos`
      );
    }

    // Notificar a la aplicación sobre el resultado
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

    // Notificar error a la aplicación
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
      // Agregar datos a la cola de sincronización
      const { tag, payload } = data;
      const success = await addToSyncQueue(tag, payload);

      // Responder a la aplicación
      event.ports[0]?.postMessage({
        success,
        message: success
          ? 'Datos agregados a cola de sincronización'
          : 'Error al agregar datos',
      });
      break;

    case 'GET_SYNC_STATUS':
      // Obtener estado de la cola de sincronización
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

console.log('Service Worker con Background Sync cargado correctamente');
