import React, { useState, useEffect } from 'react';
import { backgroundSyncService } from '../services/backgroundSyncService';

interface SyncStatusInfo {
  pendingCount: number;
  isSupported: boolean;
  lastSync: Date | null;
  recentActivity: Array<{
    type: string;
    timestamp: Date;
    status: 'success' | 'error';
    details?: string;
  }>;
}

const BackgroundSyncStatus: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>({
    pendingCount: 0,
    isSupported: backgroundSyncService.isBackgroundSyncSupported(),
    lastSync: null,
    recentActivity: []
  });

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Función para actualizar el estado
    const updateSyncStatus = async () => {
      try {
        const status = await backgroundSyncService.getSyncStatus();
        if (status.success) {
          setSyncStatus(prev => ({
            ...prev,
            pendingCount: status.pendingCount
          }));
        }
      } catch (error) {
        console.error('Error al obtener estado de sincronización:', error);
      }
    };

    // Listener para sincronización completada
    const handleSyncComplete = (event: CustomEvent) => {
      const { tag, syncedCount, failedCount, totalProcessed } = event.detail;
      
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        pendingCount: Math.max(0, prev.pendingCount - syncedCount),
        recentActivity: [
          {
            type: `Sync: ${tag}`,
            timestamp: new Date(),
            status: failedCount > 0 ? 'error' : 'success',
            details: `${syncedCount} exitosos, ${failedCount} fallidos de ${totalProcessed} total`
          },
          ...prev.recentActivity.slice(0, 4) // Mantener solo los últimos 5
        ]
      }));
    };

    // Listener para errores de sincronización
    const handleSyncError = (event: CustomEvent) => {
      const { tag, error } = event.detail;
      
      setSyncStatus(prev => ({
        ...prev,
        recentActivity: [
          {
            type: `Error: ${tag}`,
            timestamp: new Date(),
            status: 'error',
            details: error
          },
          ...prev.recentActivity.slice(0, 4)
        ]
      }));
    };

    // Agregar listeners
    window.addEventListener('backgroundSyncComplete', handleSyncComplete as EventListener);
    window.addEventListener('backgroundSyncError', handleSyncError as EventListener);

    // Actualizar estado inicial
    updateSyncStatus();

    // Actualizar cada 10 segundos
    const interval = setInterval(updateSyncStatus, 10000);

    return () => {
      window.removeEventListener('backgroundSyncComplete', handleSyncComplete as EventListener);
      window.removeEventListener('backgroundSyncError', handleSyncError as EventListener);
      clearInterval(interval);
    };
  }, []);

  if (!syncStatus.isSupported) {
    return (
      <div className="sync-status-container unsupported">
        <div className="sync-status-header">
          <span className="status-icon">⚠️</span>
          <span className="status-text">Background Sync no soportado</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sync-status-container">
      <div 
        className="sync-status-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="status-info">
          <span className="status-icon">
            {syncStatus.pendingCount > 0 ? '🔄' : '✅'}
          </span>
          <span className="status-text">
            {syncStatus.pendingCount > 0 
              ? `${syncStatus.pendingCount} pendientes de sincronización`
              : 'Todo sincronizado'
            }
          </span>
        </div>
        <button className="expand-button">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="sync-status-details">
          <div className="sync-info-grid">
            <div className="info-item">
              <span className="info-label">Estado:</span>
              <span className={`info-value ${syncStatus.pendingCount > 0 ? 'pending' : 'synced'}`}>
                {syncStatus.pendingCount > 0 ? 'Sincronizando' : 'Sincronizado'}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Pendientes:</span>
              <span className="info-value">{syncStatus.pendingCount}</span>
            </div>
            
            {syncStatus.lastSync && (
              <div className="info-item">
                <span className="info-label">Última sync:</span>
                <span className="info-value">
                  {syncStatus.lastSync.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {syncStatus.recentActivity.length > 0 && (
            <div className="recent-activity">
              <h4>Actividad Reciente</h4>
              <div className="activity-list">
                {syncStatus.recentActivity.map((activity, index) => (
                  <div key={index} className={`activity-item ${activity.status}`}>
                    <div className="activity-header">
                      <span className="activity-type">{activity.type}</span>
                      <span className="activity-time">
                        {activity.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {activity.details && (
                      <div className="activity-details">{activity.details}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sync-actions">
            <button
              className="action-button"
              onClick={async () => {
                const status = await backgroundSyncService.getSyncStatus();
                setSyncStatus(prev => ({
                  ...prev,
                  pendingCount: status.success ? status.pendingCount : prev.pendingCount
                }));
              }}
            >
              🔄 Actualizar Estado
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundSyncStatus;

