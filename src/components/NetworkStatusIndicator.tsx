import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, isOffline, connectionType } = useNetworkStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [lastStatus, setLastStatus] = useState(isOnline);

  useEffect(() => {
    // Mostrar notificación cuando cambie el estado
    if (lastStatus !== isOnline) {
      setShowNotification(true);
      setLastStatus(isOnline);
      
      // Ocultar notificación después de 3 segundos
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, lastStatus]);

  return (
    <>
      {/* Indicador fijo en la esquina */}
      <div className={`network-status-indicator ${isOffline ? 'offline' : 'online'}`}>
        <div className="status-icon">
          {isOnline ? '🌐' : '📵'}
        </div>
        <span className="status-text">
          {isOnline ? 'En línea' : 'Sin conexión'}
        </span>
        {connectionType && isOnline && (
          <span className="connection-type">({connectionType})</span>
        )}
      </div>

      {/* Notificación temporal cuando cambia el estado */}
      {showNotification && (
        <div className={`network-notification ${isOffline ? 'offline' : 'online'} ${showNotification ? 'show' : ''}`}>
          <div className="notification-content">
            <div className="notification-icon">
              {isOnline ? '✅' : '⚠️'}
            </div>
            <div className="notification-text">
              <strong>
                {isOnline ? 'Conexión restaurada' : 'Sin conexión a internet'}
              </strong>
              <p>
                {isOnline 
                  ? 'Los datos se sincronizarán automáticamente' 
                  : 'Los datos se guardarán localmente'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkStatusIndicator;
