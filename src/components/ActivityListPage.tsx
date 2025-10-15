import React, { useState, useEffect } from 'react';
import { indexedDBService } from '../services/indexedDBService';
import { syncService } from '../services/syncService';
import type { Activity } from '../services/indexedDBService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const ActivityListPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Activity['status']>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    enProgreso: 0,
    completadas: 0,
  });
  const { isOffline } = useNetworkStatus();

  // Cargar actividades y estadísticas
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await indexedDBService.init();
        
        const [allActivities, activityStats] = await Promise.all([
          indexedDBService.getAllActivities(),
          indexedDBService.getStats()
        ]);
        
        setActivities(allActivities);
        setStats(activityStats);
        setError(null);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar las actividades');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtrar actividades
  const filteredActivities = activities.filter(activity => {
    const matchesFilter = filter === 'all' || activity.status === filter;
    const matchesSearch = searchTerm === '' || 
      activity.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.activity.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta actividad?')) {
      return;
    }

    try {
      // Usar syncService para manejar eliminación y sincronización
      await syncService.deleteActivity(id);
      setActivities(prev => prev.filter(activity => activity.id !== id));
      
      // Actualizar estadísticas
      const newStats = await indexedDBService.getStats();
      setStats(newStats);
      
      if (isOffline) {
        alert('✅ Actividad eliminada localmente. Se sincronizará con Firebase cuando tengas conexión.');
      } else {
        alert('✅ Actividad eliminada y sincronizada con Firebase.');
      }
    } catch (error) {
      console.error('Error al eliminar actividad:', error);
      alert('❌ Error al eliminar la actividad');
    }
  };

  const handleStatusChange = async (id: string, newStatus: Activity['status']) => {
    try {
      // Usar syncService para manejar actualización y sincronización
      const updatedActivity = await syncService.updateActivity(id, { status: newStatus });
      setActivities(prev => 
        prev.map(activity => 
          activity.id === id ? updatedActivity : activity
        )
      );
      
      // Actualizar estadísticas
      const newStats = await indexedDBService.getStats();
      setStats(newStats);
      
      if (isOffline) {
        console.log('📱 Status actualizado localmente, se sincronizará cuando tengas conexión');
      } else {
        console.log('✅ Status actualizado y sincronizado con Firebase');
      }
    } catch (error) {
      console.error('Error al actualizar actividad:', error);
      alert('❌ Error al actualizar la actividad');
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

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <section className="activity-list-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando actividades desde la base de datos...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-list-page">
      <div className="page-header">
        <h2>📋 Lista Completa de Actividades</h2>
        <p>Gestiona todas las actividades registradas en la aplicación</p>
        
        {isOffline && (
          <div className="offline-banner">
            <span>📵</span>
            <p>Modo sin conexión - Mostrando datos locales</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total</p>
          </div>
        </div>
        
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pendientes}</h3>
            <p>Pendientes</p>
          </div>
        </div>
        
        <div className="stat-card in-progress">
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <h3>{stats.enProgreso}</h3>
            <p>En Progreso</p>
          </div>
        </div>
        
        <div className="stat-card completed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.completadas}</h3>
            <p>Completadas</p>
          </div>
        </div>
      </div>

      {/* Controles de filtrado */}
      <div className="controls-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Buscar por alumno, materia o actividad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({stats.total})
          </button>
          <button
            className={`filter-btn ${filter === 'pendiente' ? 'active' : ''}`}
            onClick={() => setFilter('pendiente')}
          >
            Pendientes ({stats.pendientes})
          </button>
          <button
            className={`filter-btn ${filter === 'en-progreso' ? 'active' : ''}`}
            onClick={() => setFilter('en-progreso')}
          >
            En Progreso ({stats.enProgreso})
          </button>
          <button
            className={`filter-btn ${filter === 'completada' ? 'active' : ''}`}
            onClick={() => setFilter('completada')}
          >
            Completadas ({stats.completadas})
          </button>
        </div>
      </div>

      {/* Lista de actividades */}
      <div className="activities-container">
        {filteredActivities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No se encontraron actividades</h3>
            <p>
              {searchTerm 
                ? `No hay actividades que coincidan con "${searchTerm}"`
                : filter === 'all' 
                  ? 'Aún no hay actividades registradas'
                  : `No hay actividades con estado "${filter}"`
              }
            </p>
          </div>
        ) : (
          <div className="activities-grid">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-header">
                  <h4>{activity.activity}</h4>
                  <div className="activity-actions">
                    <select
                      value={activity.status}
                      onChange={(e) => handleStatusChange(activity.id, e.target.value as Activity['status'])}
                      className="status-select"
                      style={{ borderColor: getStatusColor(activity.status) }}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en-progreso">En Progreso</option>
                      <option value="completada">Completada</option>
                    </select>
                    <button
                      onClick={() => handleDeleteActivity(activity.id)}
                      className="delete-btn"
                      aria-label="Eliminar actividad"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="activity-details">
                  <div className="detail-row">
                    <span className="detail-label">👤 Alumno:</span>
                    <span className="detail-value">{activity.studentName}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">📚 Materia:</span>
                    <span className="detail-value">{activity.subject}</span>
                  </div>
                  
                  {activity.description && (
                    <div className="detail-row">
                      <span className="detail-label">📄 Descripción:</span>
                      <span className="detail-value">{activity.description}</span>
                    </div>
                  )}
                  
                  <div className="detail-row">
                    <span className="detail-label">📅 Fecha:</span>
                    <span className="detail-value">{formatDate(activity.date)}</span>
                  </div>
                </div>
                
                <div 
                  className="activity-status-badge"
                  style={{ backgroundColor: getStatusColor(activity.status) }}
                >
                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ActivityListPage;
