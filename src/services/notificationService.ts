import { messaging, getToken, onMessage } from './firebase';

/**
 * Servicio para manejar notificaciones push con Firebase Cloud Messaging
 */
export class NotificationService {
  private static instance: NotificationService;
  private vapidKey: string;
  private currentToken: string | null = null;

  private constructor() {
    this.vapidKey = import.meta.env.VITE_VAPID_KEY;
    if (!this.vapidKey) {
      console.error(
        '❌ VITE_VAPID_KEY no está configurada en las variables de entorno'
      );
    }
  }

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Solicita permisos de notificación al usuario
   */
  public async requestNotificationPermission(): Promise<boolean> {
    try {
      // Verificar si las notificaciones están soportadas
      if (!('Notification' in window)) {
        console.error('❌ Este navegador no soporta notificaciones');
        return false;
      }

      // Verificar el estado actual del permiso
      if (Notification.permission === 'granted') {
        console.log('✅ Permisos de notificación ya concedidos');
        return true;
      }

      if (Notification.permission === 'denied') {
        console.warn('⚠️ Permisos de notificación denegados por el usuario');
        return false;
      }

      // Solicitar permisos
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Permisos de notificación concedidos');
        return true;
      } else {
        console.warn('⚠️ Permisos de notificación denegados');
        return false;
      }
    } catch (error) {
      console.error('❌ Error al solicitar permisos de notificación:', error);
      return false;
    }
  }

  /**
   * Obtiene el token FCM para el dispositivo actual
   */
  public async getFCMToken(): Promise<string | null> {
    try {
      if (!messaging) {
        console.error('❌ Firebase Messaging no está inicializado');
        return null;
      }

      if (!this.vapidKey) {
        console.error('❌ VAPID key no está configurada');
        return null;
      }

      // Verificar permisos antes de obtener el token
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        return null;
      }

      // Obtener el token FCM
      const token = await getToken(messaging, {
        vapidKey: this.vapidKey,
      });

      if (token) {
        console.log('✅ Token FCM obtenido:', token);
        this.currentToken = token;

        // Guardar el token en localStorage para uso posterior
        localStorage.setItem('fcm_token', token);

        return token;
      } else {
        console.warn('⚠️ No se pudo obtener el token FCM');
        return null;
      }
    } catch (error) {
      console.error('❌ Error al obtener el token FCM:', error);
      return null;
    }
  }

  /**
   * Configura el listener para mensajes en primer plano
   */
  public setupForegroundMessageListener(): void {
    if (!messaging) {
      console.error('❌ Firebase Messaging no está inicializado');
      return;
    }

    onMessage(messaging, (payload) => {
      console.log('📱 Mensaje recibido en primer plano:', payload);
      console.log('📋 Payload completo:', JSON.stringify(payload, null, 2));

      // Mostrar notificación personalizada
      this.showNotification(payload);
    });
  }

  /**
   * Muestra una notificación personalizada
   */
  private showNotification(payload: any): void {
    const { notification, data } = payload;

    if (!notification) {
      console.warn('⚠️ Payload sin datos de notificación');
      return;
    }

    const title = notification.title || 'Nueva notificación';
    const body = notification.body || '';

    console.log('🔔 Mostrando notificación:', { title, body });

    // Mostrar notificación usando Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.showNotification(title, {
            body: body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'fcm-notification',
            requireInteraction: false,
            data: data || {},
          });
        })
        .then(() => {
          console.log('✅ Notificación mostrada');
        })
        .catch((error) => {
          console.error('❌ Error al mostrar notificación:', error);
        });
    }

    // Mostrar notificación in-app adicional
    this.showInAppNotification(title, body);
  }

  /**
   * Muestra una notificación dentro de la aplicación
   */
  private showInAppNotification(title: string, body: string): void {
    // Crear elemento de notificación in-app
    const notificationElement = document.createElement('div');
    notificationElement.className = 'push-notification-toast';
    notificationElement.innerHTML = `
      <div class="push-notification-content">
        <div class="push-notification-icon">🔔</div>
        <div class="push-notification-text">
          <strong>${title}</strong>
          <p>${body}</p>
        </div>
        <button class="push-notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Agregar estilos si no existen
    if (!document.getElementById('push-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'push-notification-styles';
      styles.textContent = `
        .push-notification-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 16px;
          max-width: 300px;
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }
        .push-notification-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .push-notification-icon {
          font-size: 24px;
        }
        .push-notification-text strong {
          display: block;
          margin-bottom: 4px;
          color: #333;
        }
        .push-notification-text p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        .push-notification-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #999;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }

    // Agregar al DOM
    document.body.appendChild(notificationElement);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (notificationElement.parentElement) {
        notificationElement.remove();
      }
    }, 5000);
  }

  /**
   * Obtiene el token actual almacenado
   */
  public getCurrentToken(): string | null {
    return this.currentToken || localStorage.getItem('fcm_token');
  }

  /**
   * Elimina el token actual
   */
  public clearToken(): void {
    this.currentToken = null;
    localStorage.removeItem('fcm_token');
  }

  /**
   * Verifica si las notificaciones están habilitadas
   */
  public isNotificationEnabled(): boolean {
    return Notification.permission === 'granted';
  }
}

// Exportar instancia singleton
export const notificationService = NotificationService.getInstance();
