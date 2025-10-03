import React from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';
// CSS importado desde main.css

const PWANotifications: React.FC = () => {
  const { updateAvailable, isOffline, updateServiceWorker } = useServiceWorker();

  return (
    <>
      {/* Notificación de actualización disponible */}
      {updateAvailable && (
        <div className="pwa-notification update-notification">
          <div className="notification-content">
            <span className="notification-icon">🔄</span>
            <div className="notification-text">
              <strong>Nueva versión disponible</strong>
              <p>Hay una actualización de la aplicación lista para instalar</p>
            </div>
            <button 
              className="notification-button update-button"
              onClick={updateServiceWorker}
            >
              Actualizar
            </button>
          </div>
        </div>
      )}

      {/* Notificación de modo offline */}
      {isOffline && (
        <div className="pwa-notification offline-notification">
          <div className="notification-content">
            <span className="notification-icon">📱</span>
            <div className="notification-text">
              <strong>Modo sin conexión</strong>
              <p>Estás navegando offline. Algunas funciones pueden estar limitadas.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWANotifications;


