import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Definir la estructura de la base de datos
interface Activity {
  id: string;
  studentName: string;
  subject: string;
  activity: string;
  description: string;
  date: string;
  status: 'pendiente' | 'en-progreso' | 'completada';
  createdAt: number;
  updatedAt: number;
  // Campos para sincronización con Firestore
  firestoreId?: string; // ID del documento en Firestore
  syncStatus?: 'synced' | 'pending' | 'error'; // Estado de sincronización
  lastSyncAttempt?: number; // Último intento de sincronización
}

interface MyDB extends DBSchema {
  activities: {
    key: string;
    value: Activity;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-student': string;
      'by-sync-status': string;
      'by-firestore-id': string;
    };
  };
}

class IndexedDBService {
  private db: IDBPDatabase<MyDB> | null = null;
  private readonly DB_NAME = 'NazaDevPWA';
  private readonly DB_VERSION = 2; // Incrementar versión para agregar nuevos índices

  // Limpiar base de datos existente (para desarrollo)
  async clearDatabase(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Eliminar la base de datos completamente
      const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);

      return new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          console.log('Base de datos eliminada correctamente');
          resolve();
        };
        deleteRequest.onerror = () => {
          console.error('Error al eliminar la base de datos');
          reject(deleteRequest.error);
        };
      });
    } catch (error) {
      console.error('Error al limpiar la base de datos:', error);
      throw error;
    }
  }

  // Inicializar la base de datos
  async init(): Promise<void> {
    try {
      this.db = await openDB<MyDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          let activityStore;

          // Solo crear el object store si no existe
          if (!db.objectStoreNames.contains('activities')) {
            activityStore = db.createObjectStore('activities', {
              keyPath: 'id',
            });
          } else {
            // Si ya existe, no podemos acceder a él durante upgrade
            // Los índices se crearán automáticamente si no existen
            return;
          }

          // Crear índices solo si no existen
          const indexesToCreate = [
            { name: 'by-date', keyPath: 'date' },
            { name: 'by-status', keyPath: 'status' },
            { name: 'by-student', keyPath: 'studentName' },
            { name: 'by-sync-status', keyPath: 'syncStatus' },
            { name: 'by-firestore-id', keyPath: 'firestoreId' },
          ];

          indexesToCreate.forEach(({ name, keyPath }) => {
            if (!activityStore.indexNames.contains(name as any)) {
              try {
                activityStore.createIndex(name as any, keyPath as any);
              } catch (error) {
                console.warn(`No se pudo crear el índice ${name}:`, error);
              }
            }
          });
        },
      });
      console.log('IndexedDB inicializada correctamente');
    } catch (error) {
      console.error('Error al inicializar IndexedDB:', error);
      throw error;
    }
  }

  // Verificar si la base de datos está inicializada
  private ensureDB(): void {
    if (!this.db) {
      throw new Error('Base de datos no inicializada. Llama a init() primero.');
    }
  }

  // Agregar una nueva actividad
  async addActivity(
    activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Activity> {
    this.ensureDB();

    const now = Date.now();
    const activity: Activity = {
      ...activityData,
      id: now.toString(),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending', // Marcar como pendiente de sincronización
    };

    try {
      await this.db!.add('activities', activity);
      console.log('Actividad agregada a IndexedDB:', activity.id);
      return activity;
    } catch (error) {
      console.error('Error al agregar actividad:', error);
      throw error;
    }
  }

  // Obtener todas las actividades
  async getAllActivities(): Promise<Activity[]> {
    this.ensureDB();

    try {
      const activities = await this.db!.getAll('activities');
      // Ordenar por fecha de creación (más recientes primero)
      return activities.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error al obtener actividades:', error);
      throw error;
    }
  }

  // Obtener actividad por ID
  async getActivity(id: string): Promise<Activity | undefined> {
    this.ensureDB();

    try {
      return await this.db!.get('activities', id);
    } catch (error) {
      console.error('Error al obtener actividad:', error);
      throw error;
    }
  }

  // Actualizar una actividad
  async updateActivity(
    id: string,
    updates: Partial<Omit<Activity, 'id' | 'createdAt'>>
  ): Promise<Activity> {
    this.ensureDB();

    try {
      const existingActivity = await this.getActivity(id);
      if (!existingActivity) {
        throw new Error(`Actividad con ID ${id} no encontrada`);
      }

      const updatedActivity: Activity = {
        ...existingActivity,
        ...updates,
        updatedAt: Date.now(),
      };

      await this.db!.put('activities', updatedActivity);
      console.log('Actividad actualizada:', id);
      return updatedActivity;
    } catch (error) {
      console.error('Error al actualizar actividad:', error);
      throw error;
    }
  }

  // Eliminar una actividad
  async deleteActivity(id: string): Promise<void> {
    this.ensureDB();

    try {
      await this.db!.delete('activities', id);
      console.log('Actividad eliminada:', id);
    } catch (error) {
      console.error('Error al eliminar actividad:', error);
      throw error;
    }
  }

  // Obtener actividades por estado
  async getActivitiesByStatus(status: Activity['status']): Promise<Activity[]> {
    this.ensureDB();

    try {
      const activities = await this.db!.getAllFromIndex(
        'activities',
        'by-status',
        status
      );
      return activities.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error al obtener actividades por estado:', error);
      throw error;
    }
  }

  // Obtener actividades por estudiante
  async getActivitiesByStudent(studentName: string): Promise<Activity[]> {
    this.ensureDB();

    try {
      const activities = await this.db!.getAllFromIndex(
        'activities',
        'by-student',
        studentName
      );
      return activities.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error al obtener actividades por estudiante:', error);
      throw error;
    }
  }

  // Limpiar todas las actividades (útil para desarrollo/testing)
  async clearAllActivities(): Promise<void> {
    this.ensureDB();

    try {
      await this.db!.clear('activities');
      console.log('Todas las actividades eliminadas');
    } catch (error) {
      console.error('Error al limpiar actividades:', error);
      throw error;
    }
  }

  // Obtener estadísticas
  async getStats(): Promise<{
    total: number;
    pendientes: number;
    enProgreso: number;
    completadas: number;
  }> {
    this.ensureDB();

    try {
      const activities = await this.getAllActivities();

      return {
        total: activities.length,
        pendientes: activities.filter((a) => a.status === 'pendiente').length,
        enProgreso: activities.filter((a) => a.status === 'en-progreso').length,
        completadas: activities.filter((a) => a.status === 'completada').length,
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  // Migrar datos desde localStorage (para transición)
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const localStorageData = localStorage.getItem('studentActivities');
      if (localStorageData) {
        const activities = JSON.parse(localStorageData);

        for (const activity of activities) {
          // Agregar campos faltantes para IndexedDB
          const activityData = {
            studentName: activity.studentName,
            subject: activity.subject,
            activity: activity.activity,
            description: activity.description || '',
            date: activity.date,
            status: activity.status,
          };

          await this.addActivity(activityData);
        }

        console.log(
          `Migradas ${activities.length} actividades desde localStorage`
        );

        // Opcional: limpiar localStorage después de la migración
        // localStorage.removeItem('studentActivities');
      }
    } catch (error) {
      console.error('Error durante la migración:', error);
    }
  }

  // Métodos específicos para sincronización con Firestore

  // Obtener actividades pendientes de sincronización
  async getPendingSyncActivities(): Promise<Activity[]> {
    this.ensureDB();

    try {
      const activities = await this.db!.getAllFromIndex(
        'activities',
        'by-sync-status',
        'pending'
      );
      return activities.sort((a, b) => a.createdAt - b.createdAt);
    } catch (error) {
      console.error('Error al obtener actividades pendientes:', error);
      return [];
    }
  }

  // Marcar actividad como sincronizada
  async markAsSynced(id: string, firestoreId: string): Promise<Activity> {
    this.ensureDB();

    try {
      const updatedActivity = await this.updateActivity(id, {
        firestoreId,
        syncStatus: 'synced',
        lastSyncAttempt: Date.now(),
      });
      console.log('Actividad marcada como sincronizada:', id);
      return updatedActivity;
    } catch (error) {
      console.error('Error al marcar como sincronizada:', error);
      throw error;
    }
  }

  // Marcar actividad con error de sincronización
  async markSyncError(id: string, error?: string): Promise<Activity> {
    this.ensureDB();

    try {
      const updatedActivity = await this.updateActivity(id, {
        syncStatus: 'error',
        lastSyncAttempt: Date.now(),
      });
      console.log('Actividad marcada con error de sincronización:', id, error);
      return updatedActivity;
    } catch (syncError) {
      console.error('Error al marcar error de sincronización:', syncError);
      throw syncError;
    }
  }

  // Obtener actividades por ID de Firestore
  async getActivityByFirestoreId(
    firestoreId: string
  ): Promise<Activity | undefined> {
    this.ensureDB();

    try {
      const activities = await this.db!.getAllFromIndex(
        'activities',
        'by-firestore-id',
        firestoreId
      );
      return activities[0]; // Debería ser único
    } catch (error) {
      console.error('Error al obtener actividad por Firestore ID:', error);
      return undefined;
    }
  }

  // Obtener estadísticas de sincronización
  async getSyncStats(): Promise<{
    total: number;
    synced: number;
    pending: number;
    errors: number;
  }> {
    this.ensureDB();

    try {
      const activities = await this.getAllActivities();

      return {
        total: activities.length,
        synced: activities.filter((a) => a.syncStatus === 'synced').length,
        pending: activities.filter((a) => a.syncStatus === 'pending').length,
        errors: activities.filter((a) => a.syncStatus === 'error').length,
      };
    } catch (error) {
      console.error('Error al obtener estadísticas de sincronización:', error);
      return { total: 0, synced: 0, pending: 0, errors: 0 };
    }
  }

  // Limpiar actividades con errores de sincronización (para desarrollo)
  async clearSyncErrors(): Promise<void> {
    this.ensureDB();

    try {
      const errorActivities = await this.db!.getAllFromIndex(
        'activities',
        'by-sync-status',
        'error'
      );

      for (const activity of errorActivities) {
        await this.updateActivity(activity.id, {
          syncStatus: 'pending',
          lastSyncAttempt: undefined,
        });
      }

      console.log(
        `Limpiados ${errorActivities.length} errores de sincronización`
      );
    } catch (error) {
      console.error('Error al limpiar errores de sincronización:', error);
    }
  }
}

// Crear instancia singleton
export const indexedDBService = new IndexedDBService();

// Exportar tipos para uso en otros componentes
export type { Activity };
