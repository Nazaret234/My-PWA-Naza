import { indexedDBService } from './indexedDBService';
import { firestoreService } from './firestoreService';
import type { Activity } from './indexedDBService';

// Tipos para la cola de sincronización
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  activityId: string;
  activityData?: Activity;
  firestoreId?: string;
  timestamp: number;
  attempts: number;
  lastError?: string;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class SyncService {
  private syncQueue: SyncOperation[] = [];
  private isSyncing: boolean = false;
  private maxRetries: number = 3;
  private syncInterval: NodeJS.Timeout | null = null;
  private isIndexedDBInitialized: boolean = false;

  constructor() {
    this.setupNetworkListeners();
    this.loadSyncQueue();
    this.initializeIndexedDB();
  }

  // Inicializar IndexedDB automáticamente
  private async initializeIndexedDB(): Promise<void> {
    if (this.isIndexedDBInitialized) {
      return;
    }

    try {
      await indexedDBService.init();
      this.isIndexedDBInitialized = true;
      console.log('✅ IndexedDB inicializada por SyncService');
    } catch (error) {
      console.warn(
        '⚠️ Error al inicializar IndexedDB en SyncService, reintentando...',
        error
      );

      // Intentar limpiar y reinicializar
      try {
        await indexedDBService.clearDatabase();
        await indexedDBService.init();
        this.isIndexedDBInitialized = true;
        console.log('✅ IndexedDB reinicializada correctamente');
      } catch (retryError) {
        console.error('❌ Error crítico al inicializar IndexedDB:', retryError);
        // No lanzar error para no romper la aplicación
      }
    }
  }

  // Asegurar que IndexedDB esté inicializada antes de cualquier operación
  private async ensureIndexedDBInitialized(): Promise<void> {
    if (!this.isIndexedDBInitialized) {
      await this.initializeIndexedDB();
    }
  }

  // Configurar listeners de red
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log(
        '🔄 Conexión restaurada - Iniciando sincronización automática'
      );
      this.startAutoSync();
    });

    window.addEventListener('offline', () => {
      console.log('📵 Sin conexión - Deteniendo sincronización automática');
      this.stopAutoSync();
    });

    // Iniciar auto-sync si está online
    if (navigator.onLine) {
      this.startAutoSync();
    }
  }

  // Cargar cola de sincronización desde IndexedDB
  private async loadSyncQueue(): Promise<void> {
    try {
      const savedQueue = localStorage.getItem('syncQueue');
      if (savedQueue) {
        this.syncQueue = JSON.parse(savedQueue);
        console.log(
          `📋 Cola de sincronización cargada: ${this.syncQueue.length} operaciones pendientes`
        );
      }
    } catch (error) {
      console.error('❌ Error al cargar cola de sincronización:', error);
      this.syncQueue = [];
    }
  }

  // Guardar cola de sincronización
  private saveSyncQueue(): void {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('❌ Error al guardar cola de sincronización:', error);
    }
  }

  // Agregar operación a la cola
  private addToSyncQueue(
    operation: Omit<SyncOperation, 'id' | 'timestamp' | 'attempts'>
  ): void {
    const syncOperation: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      attempts: 0,
    };

    this.syncQueue.push(syncOperation);
    this.saveSyncQueue();

    console.log(
      `📝 Operación agregada a cola de sincronización:`,
      syncOperation.type,
      syncOperation.activityId
    );

    // Intentar sincronizar inmediatamente si está online
    if (navigator.onLine && !this.isSyncing) {
      this.syncPendingOperations();
    }
  }

  // Crear actividad (online/offline)
  async createActivity(
    activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Activity> {
    // Asegurar que IndexedDB esté inicializada
    await this.ensureIndexedDBInitialized();

    // Siempre guardar en IndexedDB primero
    const localActivity = await indexedDBService.addActivity(activityData);

    if (navigator.onLine) {
      try {
        // Intentar guardar en Firestore inmediatamente
        const firestoreId =
          await firestoreService.createActivity(localActivity);

        if (firestoreId) {
          // Actualizar actividad local con ID de Firestore
          const updatedActivity = await indexedDBService.updateActivity(
            localActivity.id,
            {
              firestoreId,
            }
          );
          console.log('✅ Actividad creada y sincronizada inmediatamente');
          return updatedActivity;
        } else {
          // Si falla Firestore, agregar a cola de sincronización
          this.addToSyncQueue({
            type: 'create',
            activityId: localActivity.id,
            activityData: localActivity,
          });
        }
      } catch (error) {
        console.error(
          '❌ Error al crear en Firestore, agregando a cola:',
          error
        );
        this.addToSyncQueue({
          type: 'create',
          activityId: localActivity.id,
          activityData: localActivity,
        });
      }
    } else {
      // Offline: agregar a cola de sincronización
      this.addToSyncQueue({
        type: 'create',
        activityId: localActivity.id,
        activityData: localActivity,
      });
      console.log('📵 Offline: Actividad agregada a cola de sincronización');
    }

    return localActivity;
  }

  // Actualizar actividad (online/offline)
  async updateActivity(
    id: string,
    updates: Partial<Omit<Activity, 'id' | 'createdAt'>>
  ): Promise<Activity> {
    // Asegurar que IndexedDB esté inicializada
    await this.ensureIndexedDBInitialized();
    // Siempre actualizar en IndexedDB primero
    const updatedActivity = await indexedDBService.updateActivity(id, updates);

    if (navigator.onLine) {
      // Si la actividad ya tiene firestoreId, actualizar en Firestore
      if (updatedActivity.firestoreId) {
        try {
          const success = await firestoreService.updateActivity(
            updatedActivity.firestoreId,
            updatedActivity
          );

          if (!success) {
            // Si falla, agregar a cola de sincronización
            this.addToSyncQueue({
              type: 'update',
              activityId: id,
              activityData: updatedActivity,
              firestoreId: updatedActivity.firestoreId,
            });
          } else {
            console.log(
              '✅ Actividad actualizada y sincronizada inmediatamente'
            );
          }
        } catch (error) {
          console.error(
            '❌ Error al actualizar en Firestore, agregando a cola:',
            error
          );
          this.addToSyncQueue({
            type: 'update',
            activityId: id,
            activityData: updatedActivity,
            firestoreId: updatedActivity.firestoreId,
          });
        }
      } else {
        // Actividad local sin firestoreId: agregar a cola para crear en Firestore
        this.addToSyncQueue({
          type: 'create', // Cambiar a 'create' porque no existe en Firestore
          activityId: id,
          activityData: updatedActivity,
        });
        console.log(
          '📤 Actividad local actualizada, agregada a cola para crear en Firestore'
        );
      }
    } else {
      // Offline: siempre agregar a cola de sincronización
      this.addToSyncQueue({
        type: updatedActivity.firestoreId ? 'update' : 'create',
        activityId: id,
        activityData: updatedActivity,
        firestoreId: updatedActivity.firestoreId,
      });
      console.log(
        '📵 Actividad actualizada localmente, agregada a cola de sincronización'
      );
    }

    return updatedActivity;
  }

  // Eliminar actividad (online/offline)
  async deleteActivity(id: string): Promise<void> {
    // Asegurar que IndexedDB esté inicializada
    await this.ensureIndexedDBInitialized();
    // Obtener la actividad antes de eliminarla para verificar si tiene firestoreId
    const activity = await indexedDBService.getActivity(id);

    if (navigator.onLine && activity?.firestoreId) {
      try {
        // Intentar eliminar de Firestore inmediatamente
        const success = await firestoreService.deleteActivity(
          activity.firestoreId
        );

        if (!success) {
          // Si falla, agregar a cola de sincronización
          this.addToSyncQueue({
            type: 'delete',
            activityId: id,
            firestoreId: activity.firestoreId,
          });
        } else {
          console.log('✅ Actividad eliminada y sincronizada inmediatamente');
        }
      } catch (error) {
        console.error(
          '❌ Error al eliminar de Firestore, agregando a cola:',
          error
        );
        this.addToSyncQueue({
          type: 'delete',
          activityId: id,
          firestoreId: activity.firestoreId,
        });
      }
    } else if (!navigator.onLine && activity?.firestoreId) {
      // Offline pero tiene firestoreId: agregar a cola para eliminar cuando vuelva conexión
      this.addToSyncQueue({
        type: 'delete',
        activityId: id,
        firestoreId: activity.firestoreId,
      });
      console.log(
        '📵 Actividad eliminada localmente, se eliminará de Firestore cuando tengas conexión'
      );
    } else {
      // Actividad solo local (sin firestoreId): no necesita sincronización
      console.log(
        '🗑️ Actividad local eliminada (no requiere sincronización con Firestore)'
      );
    }

    // Siempre eliminar de IndexedDB
    await indexedDBService.deleteActivity(id);
  }

  // Sincronizar operaciones pendientes
  async syncPendingOperations(): Promise<SyncResult> {
    if (this.isSyncing || !navigator.onLine || this.syncQueue.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    this.isSyncing = true;
    console.log(
      `🔄 Iniciando sincronización de ${this.syncQueue.length} operaciones pendientes`
    );

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const operationsToProcess = [...this.syncQueue];

    for (const operation of operationsToProcess) {
      try {
        const success = await this.processSyncOperation(operation);

        if (success) {
          // Remover de la cola si fue exitoso
          this.syncQueue = this.syncQueue.filter(
            (op) => op.id !== operation.id
          );
          result.syncedCount++;
          console.log(
            `✅ Operación sincronizada: ${operation.type} - ${operation.activityId}`
          );
        } else {
          // Incrementar intentos
          operation.attempts++;
          operation.lastError = 'Operación falló';

          if (operation.attempts >= this.maxRetries) {
            // Remover después de máximos intentos
            this.syncQueue = this.syncQueue.filter(
              (op) => op.id !== operation.id
            );
            result.failedCount++;
            result.errors.push(
              `Operación ${operation.type} falló después de ${this.maxRetries} intentos`
            );
            console.error(
              `❌ Operación falló definitivamente: ${operation.type} - ${operation.activityId}`
            );
          }
        }

        // Pequeña pausa entre operaciones
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        operation.attempts++;
        operation.lastError =
          error instanceof Error ? error.message : 'Error desconocido';

        if (operation.attempts >= this.maxRetries) {
          this.syncQueue = this.syncQueue.filter(
            (op) => op.id !== operation.id
          );
          result.failedCount++;
          result.errors.push(
            `Error en operación ${operation.type}: ${operation.lastError}`
          );
        }

        console.error(`❌ Error en sincronización:`, error);
      }
    }

    this.saveSyncQueue();
    this.isSyncing = false;

    if (result.failedCount > 0) {
      result.success = false;
    }

    console.log(
      `✅ Sincronización completada: ${result.syncedCount} exitosas, ${result.failedCount} fallidas`
    );
    return result;
  }

  // Procesar una operación de sincronización individual
  private async processSyncOperation(
    operation: SyncOperation
  ): Promise<boolean> {
    switch (operation.type) {
      case 'create':
        if (operation.activityData) {
          const firestoreId = await firestoreService.createActivity(
            operation.activityData
          );
          if (firestoreId) {
            // Actualizar ID local con ID de Firestore
            await indexedDBService.updateActivity(operation.activityId, {
              firestoreId,
            });
            return true;
          }
        }
        return false;

      case 'update':
        if (operation.firestoreId && operation.activityData) {
          return await firestoreService.updateActivity(
            operation.firestoreId,
            operation.activityData
          );
        }
        return false;

      case 'delete':
        if (operation.firestoreId) {
          return await firestoreService.deleteActivity(operation.firestoreId);
        }
        return false;

      default:
        return false;
    }
  }

  // Iniciar sincronización automática
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sincronizar cada 30 segundos si hay operaciones pendientes
    this.syncInterval = setInterval(() => {
      if (this.syncQueue.length > 0 && navigator.onLine && !this.isSyncing) {
        this.syncPendingOperations();
      }
    }, 30000);

    // Sincronizar inmediatamente
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.syncPendingOperations(), 1000);
    }
  }

  // Detener sincronización automática
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Obtener estado de la cola de sincronización
  getSyncQueueStatus(): {
    pendingOperations: number;
    isSyncing: boolean;
    operations: SyncOperation[];
  } {
    return {
      pendingOperations: this.syncQueue.length,
      isSyncing: this.isSyncing,
      operations: [...this.syncQueue],
    };
  }

  // Limpiar cola de sincronización (para desarrollo/testing)
  clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
    console.log('🧹 Cola de sincronización limpiada');
  }
}

// Crear instancia singleton
export const syncService = new SyncService();

// Exportar tipos
export type { SyncOperation, SyncResult };
