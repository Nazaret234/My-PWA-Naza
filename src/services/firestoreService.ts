import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import app from './firebase/index';
import type { Activity } from './indexedDBService';

// Extender la interfaz Activity para incluir campos de Firestore
interface FirestoreActivity extends Omit<Activity, 'createdAt' | 'updatedAt'> {
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  firestoreId?: string; // ID del documento en Firestore
  syncStatus: 'synced' | 'pending' | 'error'; // Estado de sincronización
  lastSyncAttempt?: number; // Último intento de sincronización
}

class FirestoreService {
  private db;
  private activitiesCollection;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.db = getFirestore(app);
    this.activitiesCollection = collection(this.db, 'activities');

    // Escuchar cambios de conectividad
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Conexión restaurada - Habilitando Firestore');
      enableNetwork(this.db);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📵 Sin conexión - Deshabilitando Firestore');
      disableNetwork(this.db);
    });
  }

  // Crear actividad en Firestore
  async createActivity(activity: Activity): Promise<string | null> {
    if (!this.isOnline) {
      console.log('📵 Offline - Actividad se guardará solo en IndexedDB');
      return null;
    }

    try {
      const firestoreActivity = {
        studentName: activity.studentName,
        subject: activity.subject,
        activity: activity.activity,
        description: activity.description,
        date: activity.date,
        status: activity.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        syncStatus: 'synced' as const,
      };

      const docRef = await addDoc(this.activitiesCollection, firestoreActivity);
      console.log('✅ Actividad creada en Firestore:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error al crear actividad en Firestore:', error);
      return null;
    }
  }

  // Actualizar actividad en Firestore
  async updateActivity(
    firestoreId: string,
    updates: Partial<Activity>
  ): Promise<boolean> {
    if (!this.isOnline) {
      console.log('📵 Offline - Actualización se guardará solo en IndexedDB');
      return false;
    }

    try {
      const docRef = doc(this.db, 'activities', firestoreId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        syncStatus: 'synced',
      });
      console.log('✅ Actividad actualizada en Firestore:', firestoreId);
      return true;
    } catch (error) {
      console.error('❌ Error al actualizar actividad en Firestore:', error);
      return false;
    }
  }

  // Eliminar actividad de Firestore
  async deleteActivity(firestoreId: string): Promise<boolean> {
    if (!this.isOnline) {
      console.log('📵 Offline - Eliminación se guardará solo en IndexedDB');
      return false;
    }

    try {
      const docRef = doc(this.db, 'activities', firestoreId);
      await deleteDoc(docRef);
      console.log('✅ Actividad eliminada de Firestore:', firestoreId);
      return true;
    } catch (error) {
      console.error('❌ Error al eliminar actividad de Firestore:', error);
      return false;
    }
  }

  // Obtener todas las actividades de Firestore
  async getAllActivities(): Promise<FirestoreActivity[]> {
    if (!this.isOnline) {
      console.log('📵 Offline - No se pueden obtener actividades de Firestore');
      return [];
    }

    try {
      const q = query(this.activitiesCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const activities: FirestoreActivity[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          firestoreId: doc.id,
          studentName: data.studentName,
          subject: data.subject,
          activity: data.activity,
          description: data.description,
          date: data.date,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          syncStatus: 'synced',
        });
      });

      console.log(`✅ Obtenidas ${activities.length} actividades de Firestore`);
      return activities;
    } catch (error) {
      console.error('❌ Error al obtener actividades de Firestore:', error);
      return [];
    }
  }

  // Sincronizar actividad pendiente con Firestore
  async syncPendingActivity(activity: Activity): Promise<string | null> {
    if (!this.isOnline) {
      return null;
    }

    try {
      // Si ya tiene firestoreId, actualizar; si no, crear
      if (activity.id && activity.id.startsWith('firestore_')) {
        const firestoreId = activity.id.replace('firestore_', '');
        const success = await this.updateActivity(firestoreId, activity);
        return success ? firestoreId : null;
      } else {
        return await this.createActivity(activity);
      }
    } catch (error) {
      console.error('❌ Error al sincronizar actividad:', error);
      return null;
    }
  }

  // Sincronizar múltiples actividades pendientes
  async syncPendingActivities(activities: Activity[]): Promise<{
    synced: number;
    failed: number;
    results: Array<{
      id: string;
      firestoreId: string | null;
      success: boolean;
    }>;
  }> {
    if (!this.isOnline) {
      return { synced: 0, failed: activities.length, results: [] };
    }

    console.log(
      `🔄 Iniciando sincronización de ${activities.length} actividades pendientes`
    );

    const results = [];
    let synced = 0;
    let failed = 0;

    for (const activity of activities) {
      try {
        const firestoreId = await this.syncPendingActivity(activity);
        const success = firestoreId !== null;

        results.push({
          id: activity.id,
          firestoreId,
          success,
        });

        if (success) {
          synced++;
        } else {
          failed++;
        }

        // Pequeña pausa entre sincronizaciones para no sobrecargar
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Error al sincronizar actividad ${activity.id}:`,
          error
        );
        results.push({
          id: activity.id,
          firestoreId: null,
          success: false,
        });
        failed++;
      }
    }

    console.log(
      `✅ Sincronización completada: ${synced} exitosas, ${failed} fallidas`
    );
    return { synced, failed, results };
  }

  // Verificar si Firestore está disponible
  async isFirestoreAvailable(): Promise<boolean> {
    if (!this.isOnline) {
      return false;
    }

    try {
      // Intentar una operación simple para verificar conectividad
      const testDoc = doc(this.db, 'test', 'connectivity');
      await getDoc(testDoc);
      return true;
    } catch (error) {
      console.error('❌ Firestore no disponible:', error);
      return false;
    }
  }

  // Escuchar cambios en tiempo real (opcional para futuras funcionalidades)
  subscribeToActivities(
    callback: (activities: FirestoreActivity[]) => void
  ): () => void {
    if (!this.isOnline) {
      return () => {}; // Retornar función vacía si está offline
    }

    const q = query(this.activitiesCollection, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (querySnapshot) => {
        const activities: FirestoreActivity[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            firestoreId: doc.id,
            studentName: data.studentName,
            subject: data.subject,
            activity: data.activity,
            description: data.description,
            date: data.date,
            status: data.status,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            syncStatus: 'synced',
          });
        });
        callback(activities);
      },
      (error) => {
        console.error('❌ Error en suscripción a Firestore:', error);
      }
    );
  }

  // Obtener estado de conectividad
  getConnectionStatus(): { isOnline: boolean; isFirestoreEnabled: boolean } {
    return {
      isOnline: this.isOnline,
      isFirestoreEnabled: this.isOnline,
    };
  }
}

// Crear instancia singleton
export const firestoreService = new FirestoreService();

// Exportar tipos
export type { FirestoreActivity };
