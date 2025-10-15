import React from 'react';

interface OfflinePageProps {
  onRetry?: () => void;
}

const OfflinePage: React.FC<OfflinePageProps> = ({ onRetry }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="offline-page">
      <div className="offline-content">
        <div className="offline-icon">
          📵
        </div>
        <h1>Sin Conexión</h1>
        <p>
          No tienes conexión a internet en este momento. 
          Algunas funciones pueden no estar disponibles.
        </p>
        
        <div className="offline-actions">
          <button 
            className="retry-btn"
            onClick={handleRetry}
          >
            🔄 Reintentar
          </button>
          
          <button 
            className="home-btn"
            onClick={() => window.location.href = '/'}
          >
            🏠 Ir al Inicio
          </button>
        </div>
        
        <div className="offline-tips">
          <h3>Mientras tanto puedes:</h3>
          <ul>
            <li>📝 Crear nuevas actividades (se sincronizarán cuando vuelvas a tener conexión)</li>
            <li>👀 Ver actividades guardadas previamente</li>
            <li>📊 Revisar reportes locales</li>
          </ul>
        </div>
        
        <div className="offline-footer">
          <small>
            Esta aplicación funciona sin conexión gracias a la tecnología PWA
          </small>
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;
