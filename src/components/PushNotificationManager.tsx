import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

interface PushNotificationManagerProps {
  onTokenReceived?: (token: string) => void;
}

const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ 
  onTokenReceived 
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar estado inicial
    checkNotificationStatus();
    
    // Configurar listener para mensajes en primer plano
    notificationService.setupForegroundMessageListener();
    
    // Obtener token existente si ya hay permisos
    const existingToken = notificationService.getCurrentToken();
    if (existingToken) {
      setToken(existingToken);
      onTokenReceived?.(existingToken);
    }
  }, [onTokenReceived]);

  const checkNotificationStatus = () => {
    const enabled = notificationService.isNotificationEnabled();
    setIsEnabled(enabled);
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Solicitar permisos
      const hasPermission = await notificationService.requestNotificationPermission();
      
      if (!hasPermission) {
        setError('Permisos de notificación denegados. Puedes habilitarlos en la configuración del navegador.');
        setIsLoading(false);
        return;
      }

      // Obtener token FCM
      const fcmToken = await notificationService.getFCMToken();
      
      if (fcmToken) {
        setToken(fcmToken);
        setIsEnabled(true);
        onTokenReceived?.(fcmToken);
        console.log('✅ Notificaciones habilitadas correctamente');
      } else {
        setError('No se pudo obtener el token de notificación. Verifica tu configuración de Firebase.');
      }
    } catch (err) {
      console.error('❌ Error al habilitar notificaciones:', err);
      setError('Error al configurar las notificaciones. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    notificationService.clearToken();
    setToken(null);
    setIsEnabled(false);
    setError(null);
  };

  const copyTokenToClipboard = async () => {
    if (token) {
      try {
        await navigator.clipboard.writeText(token);
        alert('Token copiado al portapapeles');
      } catch (err) {
        console.error('Error al copiar token:', err);
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Token copiado al portapapeles');
      }
    }
  };

  const sendTestNotification = () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // Simular una notificación de prueba local
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification('Notificación de prueba', {
          body: 'Esta es una notificación de prueba generada localmente',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'test-notification',
          requireInteraction: false,
          actions: [
            {
              action: 'open',
              title: 'Abrir'
            }
          ]
        });
      });
    }
  };

  return (
    <div className="push-notification-manager">
      <div className="notification-header">
        <h3>🔔 Notificaciones Push</h3>
        <p>Recibe notificaciones importantes de la aplicación</p>
      </div>

      <div className="notification-status">
        <div className={`status-indicator ${isEnabled ? 'enabled' : 'disabled'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isEnabled ? 'Habilitadas' : 'Deshabilitadas'}
          </span>
        </div>
      </div>

      {error && (
        <div className="notification-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <div className="notification-actions">
        {!isEnabled ? (
          <button 
            className="notification-button enable-button"
            onClick={handleEnableNotifications}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Configurando...
              </>
            ) : (
              <>
                <span className="button-icon">🔔</span>
                Habilitar Notificaciones
              </>
            )}
          </button>
        ) : (
          <div className="enabled-actions">
            {/* <button 
              className="notification-button test-button"
              onClick={sendTestNotification}
            >
              <span className="button-icon">🧪</span>
              Probar Notificación
            </button> */}
            
            <button 
              className="notification-button disable-button"
              onClick={handleDisableNotifications}
            >
              <span className="button-icon">🔕</span>
              Deshabilitar
            </button>
          </div>
        )}
      </div>

      {token && (
        <div className="token-section">
          <h4>Token FCM:</h4>
          <div className="token-display">
            <code className="token-text">
              {token.substring(0, 50)}...
            </code>
            <button 
              className="copy-button"
              onClick={copyTokenToClipboard}
              title="Copiar token completo"
            >
              📋
            </button>
          </div>
          <p className="token-info">
            💡 Usa este token para enviar notificaciones desde Firebase Console o tu backend
          </p>
        </div>
      )}

      <div className="notification-info">
        <h4>ℹ️ Información:</h4>
        <ul>
          <li>Las notificaciones funcionan incluso cuando la app está cerrada</li>
          <li>Puedes personalizar el comportamiento en la configuración del navegador</li>
          <li>El token se renueva automáticamente cuando es necesario</li>
        </ul>
      </div>
    </div>
  );
};

export default PushNotificationManager;
