/**
 * Background Sync Service
 * Maneja la comunicación con el Service Worker para Background Sync API
 */

import React from 'react';
import { syncService } from './syncService';
import type { Activity } from './indexedDBService';

interface SyncQueueItem {
  tag: string;
  data: any;
  timestamp: number;
}

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string | null;
  syncedCount?: number;
  failedCount?: number;
  totalProcessed?: number;
  result?: any;
}

class BackgroundSyncService {
  private serviceWorker: ServiceWorker | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
    this.setupServiceWorker();
    this.setupMessageListeners();
  }

  // Verificar soporte para Background Sync
  private checkSupport(): void {
    this.isSupported =
      'serviceWorker' in navigator &&
      'sync' in window.ServiceWorkerRegistration.prototype;

    if (this.isSupported) {
      console.log('✅ Background Sync API soportado');
    } else {
      console.warn('⚠️ Background Sync API no soportado en este navegador');
    }
  }

  // Configurar Service Worker
  private async setupServiceWorker(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      this.serviceWorker = registration.active;
      console.log('✅ Service Worker listo para Background Sync');
    } catch (error) {
      console.error('❌ Error al configurar Service Worker:', error);
    }
  }

  // Configurar listeners de mensajes del Service Worker
  private setupMessageListeners(): void {
    if (!this.isSupported) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const {
        type,
        tag,
        syncedCount,
        failedCount,
        totalProcessed,
        error,
        data,
      } = event.data;

      switch (type) {
        case 'BACKGROUND_SYNC_COMPLETE':
          console.log(`✅ Sincronización completada: ${tag}`);
          console.log(
            `📊 Estadísticas: ${syncedCount} exitosos, ${failedCount} fallidos de ${totalProcessed} total`
          );

          // Disparar evento personalizado para que los componentes puedan reaccionar
          window.dispatchEvent(
            new CustomEvent('backgroundSyncComplete', {
              detail: { tag, syncedCount, failedCount, totalProcessed },
            })
          );
          break;

        case 'BACKGROUND_SYNC_ERROR':
          console.error(`❌ Error en sincronización: ${tag}`, error);

          // Disparar evento de error
          window.dispatchEvent(
            new CustomEvent('backgroundSyncError', {
              detail: { tag, error },
            })
          );
          break;

        case 'SYNC_TO_FIRESTORE':
          // Manejar solicitud de sincronización desde Service Worker
          this.handleFirestoreSync(event, tag, data);
          break;
      }
    });
  }

  // Manejar sincronización con Firestore desde Service Worker
  private async handleFirestoreSync(
    event: MessageEvent,
    tag: string,
    data: any
  ): Promise<void> {
    try {
      console.log(
        `🔄 Manejando sincronización Firestore desde SW: ${tag}`,
        data
      );

      let result: SyncResult = { success: false, result: null, error: null };

      switch (tag) {
        case 'sync-entries':
          // Crear nueva actividad
          if (data.type === 'create' && data.activity) {
            result = await this.syncCreateActivity(data.activity);
          }
          break;

        case 'sync-updates':
          // Actualizar actividad
          if (data.type === 'update' && data.activityId && data.updates) {
            result = await this.syncUpdateActivityFirestore(
              data.activityId,
              data.updates
            );
          }
          break;

        case 'sync-deletes':
          // Eliminar actividad
          if (data.type === 'delete' && data.activityId) {
            result = await this.syncDeleteActivityFirestore(data.activityId);
          }
          break;

        default:
          result = {
            success: false,
            error: `Tipo de sync no soportado: ${tag}`,
          };
      }

      // Responder al Service Worker
      event.ports[0]?.postMessage(result);
    } catch (error) {
      console.error('Error en handleFirestoreSync:', error);
      event.ports[0]?.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  // Métodos de sincronización específicos para Firestore
  private async syncCreateActivity(
    activityData: Activity
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Usar el syncService existente para crear actividad
      const createdActivity = await syncService.createActivity(activityData);
      return { success: true, result: createdActivity };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Error al crear actividad',
      };
    }
  }

  private async syncUpdateActivityFirestore(
    activityId: string,
    updates: Partial<Activity>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Usar el syncService existente para actualizar actividad
      const updatedActivity = await syncService.updateActivity(
        activityId,
        updates
      );
      return { success: true, result: updatedActivity };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al actualizar actividad',
      };
    }
  }

  private async syncDeleteActivityFirestore(
    activityId: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Usar el syncService existente para eliminar actividad
      await syncService.deleteActivity(activityId);
      return { success: true, result: { deleted: true, activityId } };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al eliminar actividad',
      };
    }
  }

  // Agregar datos a la cola de sincronización
  async queueForSync(tag: string, data: any): Promise<SyncResult> {
    if (!this.isSupported) {
      return {
        success: false,
        error: 'Background Sync no soportado',
      };
    }

    if (!this.serviceWorker) {
      await this.setupServiceWorker();
    }

    try {
      // Crear canal de comunicación
      const messageChannel = new MessageChannel();

      // Configurar respuesta
      const responsePromise = new Promise<SyncResult>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      // Enviar mensaje al Service Worker
      this.serviceWorker?.postMessage(
        {
          type: 'QUEUE_FOR_SYNC',
          data: { tag, payload: data },
        },
        [messageChannel.port2]
      );

      const result = await responsePromise;

      if (result.success) {
        console.log(`📝 Datos agregados a cola de sincronización: ${tag}`);
      } else {
        console.error(`❌ Error al agregar a cola: ${result.message}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error en queueForSync:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // Obtener estado de la cola de sincronización
  async getSyncStatus(): Promise<{
    pendingCount: number;
    success: boolean;
    error?: string;
  }> {
    if (!this.isSupported || !this.serviceWorker) {
      return {
        pendingCount: 0,
        success: false,
        error: 'Service Worker no disponible',
      };
    }

    try {
      const messageChannel = new MessageChannel();

      const responsePromise = new Promise<any>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
      });

      this.serviceWorker.postMessage(
        {
          type: 'GET_SYNC_STATUS',
        },
        [messageChannel.port2]
      );

      return await responsePromise;
    } catch (error) {
      return {
        pendingCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // Métodos específicos para diferentes tipos de sincronización

  // Sincronizar nueva actividad (formulario offline)
  async syncNewActivity(activityData: any): Promise<SyncResult> {
    return this.queueForSync('sync-entries', {
      type: 'create',
      activity: activityData,
      timestamp: Date.now(),
    });
  }

  // Sincronizar actualización de actividad
  async syncUpdateActivity(
    activityId: string,
    updates: any
  ): Promise<SyncResult> {
    return this.queueForSync('sync-updates', {
      type: 'update',
      activityId,
      updates,
      timestamp: Date.now(),
    });
  }

  // Sincronizar eliminación de actividad
  async syncDeleteActivity(activityId: string): Promise<SyncResult> {
    return this.queueForSync('sync-deletes', {
      type: 'delete',
      activityId,
      timestamp: Date.now(),
    });
  }

  // Verificar si Background Sync está soportado
  isBackgroundSyncSupported(): boolean {
    return this.isSupported;
  }

  // Obtener información del servicio
  getServiceInfo(): {
    isSupported: boolean;
    hasServiceWorker: boolean;
    isReady: boolean;
  } {
    return {
      isSupported: this.isSupported,
      hasServiceWorker: this.serviceWorker !== null,
      isReady: this.isSupported && this.serviceWorker !== null,
    };
  }
}

// Crear instancia singleton
export const backgroundSyncService = new BackgroundSyncService();

// Hook personalizado para React
export const useBackgroundSync = () => {
  const [syncStatus, setSyncStatus] = React.useState({
    pendingCount: 0,
    isSupported: backgroundSyncService.isBackgroundSyncSupported(),
    lastSync: null as Date | null,
  });

  React.useEffect(() => {
    // Listener para sincronización completada
    const handleSyncComplete = (event: CustomEvent) => {
      setSyncStatus((prev) => ({
        ...prev,
        lastSync: new Date(),
        pendingCount: Math.max(
          0,
          prev.pendingCount - (event.detail.syncedCount || 0)
        ),
      }));
    };

    // Listener para errores de sincronización
    const handleSyncError = (event: CustomEvent) => {
      console.error('Error en Background Sync:', event.detail);
    };

    // Agregar listeners
    window.addEventListener(
      'backgroundSyncComplete',
      handleSyncComplete as EventListener
    );
    window.addEventListener(
      'backgroundSyncError',
      handleSyncError as EventListener
    );

    // Obtener estado inicial
    const updateSyncStatus = async () => {
      const status = await backgroundSyncService.getSyncStatus();
      if (status.success) {
        setSyncStatus((prev) => ({
          ...prev,
          pendingCount: status.pendingCount,
        }));
      }
    };

    updateSyncStatus();

    // Actualizar estado cada 30 segundos
    const interval = setInterval(updateSyncStatus, 30000);

    return () => {
      window.removeEventListener(
        'backgroundSyncComplete',
        handleSyncComplete as EventListener
      );
      window.removeEventListener(
        'backgroundSyncError',
        handleSyncError as EventListener
      );
      clearInterval(interval);
    };
  }, []);

  return {
    ...syncStatus,
    queueForSync: backgroundSyncService.queueForSync.bind(
      backgroundSyncService
    ),
    syncNewActivity: backgroundSyncService.syncNewActivity.bind(
      backgroundSyncService
    ),
    syncUpdateActivity: backgroundSyncService.syncUpdateActivity.bind(
      backgroundSyncService
    ),
    syncDeleteActivity: backgroundSyncService.syncDeleteActivity.bind(
      backgroundSyncService
    ),
    getSyncStatus: backgroundSyncService.getSyncStatus.bind(
      backgroundSyncService
    ),
  };
};

// Exportar tipos
export type { SyncQueueItem, SyncResult };
