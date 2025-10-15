import React, { useState, useEffect } from 'react';
import { indexedDBService } from '../services/indexedDBService';
import { syncService } from '../services/syncService';
import type { Activity } from '../services/indexedDBService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const ActivityReportForm: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, synced: 0, errors: 0 });
  const { isOffline } = useNetworkStatus();
  const [formData, setFormData] = useState({
    studentName: '',
    subject: '',
    activity: '',
    description: '',
    status: 'pendiente' as Activity['status']
  });

  // Inicializar IndexedDB y cargar actividades
  useEffect(() => {
    const initializeDB = async () => {
      try {
        setLoading(true);
        
        // Intentar inicializar IndexedDB
        try {
          await indexedDBService.init();
        } catch (dbError) {
          console.warn('Error al inicializar IndexedDB, limpiando y reintentando:', dbError);
          
          // Si falla, limpiar la base de datos y reintentar
          await indexedDBService.clearDatabase();
          await indexedDBService.init();
        }
        
        // Migrar datos desde localStorage si existen
        await indexedDBService.migrateFromLocalStorage();
        
        // Cargar actividades desde IndexedDB
        const loadedActivities = await indexedDBService.getAllActivities();
        setActivities(loadedActivities);
        
        // Cargar estadísticas de sincronización
        const stats = await indexedDBService.getSyncStats();
        setSyncStatus(stats);
        
        setError(null);
      } catch (err) {
        console.error('Error al inicializar la base de datos:', err);
        setError('Error al cargar los datos. Usando modo de emergencia...');
        
        // Fallback a localStorage si IndexedDB falla completamente
        try {
          const savedActivities = localStorage.getItem('studentActivities');
          if (savedActivities) {
            const parsedActivities = JSON.parse(savedActivities);
            // Convertir formato de localStorage a formato de IndexedDB
            const convertedActivities = parsedActivities.map((activity: any) => ({
              ...activity,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              syncStatus: 'pending',
            }));
            setActivities(convertedActivities);
          }
        } catch (localStorageError) {
          console.error('Error al cargar desde localStorage:', localStorageError);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeDB();
  }, []);

  // Actualizar estadísticas de sincronización periódicamente
  useEffect(() => {
    const updateSyncStats = async () => {
      try {
        // Solo actualizar si IndexedDB está inicializada
        if (indexedDBService && !loading) {
          const stats = await indexedDBService.getSyncStats();
          setSyncStatus(stats);
        }
      } catch (error) {
        // Solo mostrar error si no es por base de datos no inicializada
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Base de datos no inicializada')) {
          console.error('Error al actualizar estadísticas de sincronización:', error);
        }
      }
    };

    // Esperar un poco antes de iniciar el intervalo
    const timeout = setTimeout(() => {
      const interval = setInterval(updateSyncStats, 5000); // Cada 5 segundos
      
      // Limpiar intervalo cuando el componente se desmonte
      return () => clearInterval(interval);
    }, 2000); // Esperar 2 segundos antes de iniciar

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.studentName || !formData.subject || !formData.activity) {
      alert('Por favor, completa todos los campos obligatorios');
      return;
    }

    try {
      const activityData = {
        studentName: formData.studentName,
        subject: formData.subject,
        activity: formData.activity,
        description: formData.description,
        date: new Date().toLocaleDateString('es-ES'),
        status: formData.status,
      };

      // Usar el servicio de sincronización en lugar de IndexedDB directamente
      const newActivity = await syncService.createActivity(activityData);
      setActivities(prev => [newActivity, ...prev]);
      
      // Actualizar estadísticas de sincronización
      const stats = await indexedDBService.getSyncStats();
      setSyncStatus(stats);
      
      // Limpiar formulario
      setFormData({
        studentName: '',
        subject: '',
        activity: '',
        description: '',
        status: 'pendiente'
      });

      // Mostrar mensaje de éxito
      if (isOffline) {
        alert('✅ Actividad guardada localmente. Se sincronizará automáticamente cuando tengas conexión.');
      } else {
        alert('✅ Actividad guardada y sincronizada con Firebase.');
      }
      
    } catch (error) {
      console.error('Error al guardar actividad:', error);
      alert('❌ Error al guardar la actividad. Inténtalo de nuevo.');
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      // Usar el servicio de sincronización para eliminar
      await syncService.deleteActivity(id);
      setActivities(prev => prev.filter(activity => activity.id !== id));
      
      // Actualizar estadísticas de sincronización
      const stats = await indexedDBService.getSyncStats();
      setSyncStatus(stats);
    } catch (error) {
      console.error('Error al eliminar actividad:', error);
      alert('❌ Error al eliminar la actividad. Inténtalo de nuevo.');
    }
  };

  const updateActivityStatus = async (id: string, newStatus: Activity['status']) => {
    try {
      // Usar el servicio de sincronización para actualizar
      const updatedActivity = await syncService.updateActivity(id, { status: newStatus });
      setActivities(prev => 
        prev.map(activity => 
          activity.id === id ? updatedActivity : activity
        )
      );
      
      // Actualizar estadísticas de sincronización
      const stats = await indexedDBService.getSyncStats();
      setSyncStatus(stats);
    } catch (error) {
      console.error('Error al actualizar actividad:', error);
      alert('❌ Error al actualizar la actividad. Inténtalo de nuevo.');
    }
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'pendiente': return '#ff6b6b';
      case 'en-progreso': return '#ffd93d';
      case 'completada': return '#51cf66';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return (
      <section className="activity-report-section">
        <div className="form-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Cargando actividades...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-report-section">
      <div className="form-container">
        <h3>📝 Reporte de Actividades del Alumno</h3>
        
        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}
        
        {isOffline && (
          <div className="offline-notice">
            <span>📵</span>
            <p>Modo sin conexión: Los datos se guardan localmente</p>
          </div>
        )}
        
        {/* Indicador de estado de sincronización */}
        {(syncStatus.pending > 0 || syncStatus.errors > 0) && (
          <div className="sync-status-notice">
            <span>🔄</span>
            <div className="sync-details">
              <p>
                <strong>Estado de sincronización:</strong>
              </p>
              <div className="sync-stats">
                {syncStatus.pending > 0 && (
                  <span className="sync-stat pending">
                    ⏳ {syncStatus.pending} pendientes
                  </span>
                )}
                {syncStatus.synced > 0 && (
                  <span className="sync-stat synced">
                    ✅ {syncStatus.synced} sincronizadas
                  </span>
                )}
                {syncStatus.errors > 0 && (
                  <span className="sync-stat error">
                    ❌ {syncStatus.errors} con errores
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="activity-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="studentName">Nombre del Alumno *</label>
              <input
                type="text"
                id="studentName"
                name="studentName"
                value={formData.studentName}
                onChange={handleInputChange}
                placeholder="Ingresa el nombre completo"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="subject">Materia *</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Ej: Matemáticas, Historia..."
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="activity">Actividad *</label>
            <input
              type="text"
              id="activity"
              name="activity"
              value={formData.activity}
              onChange={handleInputChange}
              placeholder="Título de la actividad"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe los detalles de la actividad..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Estado</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en-progreso">En Progreso</option>
              <option value="completada">Completada</option>
            </select>
          </div>

          <button type="submit" className="submit-btn">
            ✅ Agregar Actividad
          </button>
        </form>
      </div>

      {activities.length > 0 && (
        <div className="activities-list">
          <h4>📋 Actividades Registradas ({activities.length})</h4>
          
          <div className="activities-grid">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-card">
                <div className="activity-header">
                  <h5>{activity.activity}</h5>
                  <div className="activity-actions">
                    <select
                      value={activity.status}
                      onChange={(e) => updateActivityStatus(activity.id, e.target.value as Activity['status'])}
                      className="status-select"
                      style={{ borderColor: getStatusColor(activity.status) }}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en-progreso">En Progreso</option>
                      <option value="completada">Completada</option>
                    </select>
                    <button
                      onClick={() => deleteActivity(activity.id)}
                      className="delete-btn"
                      aria-label="Eliminar actividad"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="activity-info">
                  <p><strong>Alumno:</strong> {activity.studentName}</p>
                  <p><strong>Materia:</strong> {activity.subject}</p>
                  {activity.description && (
                    <p><strong>Descripción:</strong> {activity.description}</p>
                  )}
                  <p><strong>Fecha:</strong> {activity.date}</p>
                </div>
                
                <div 
                  className="activity-status"
                  style={{ backgroundColor: getStatusColor(activity.status) }}
                >
                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>
                
                {/* Indicador de estado de sincronización */}
                <div className={`sync-indicator ${activity.syncStatus || 'pending'}`}>
                  {activity.syncStatus === 'synced' && '☁️'}
                  {activity.syncStatus === 'pending' && '⏳'}
                  {activity.syncStatus === 'error' && '⚠️'}
                  {!activity.syncStatus && '⏳'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ActivityReportForm;
