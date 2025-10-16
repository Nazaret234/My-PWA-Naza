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
        console.log('✅ Token FCM obtenido correctamente');
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
      console.log('📱 Mensaje recibido en primer plano');

      // Mostrar notificación personalizada
      this.showNotification(payload);
    });
  }

  /**
   * Muestra una notificación del sistema (como Slack, Discord, etc.)
   */
  private showNotification(payload: any): void {
    const { notification, data } = payload;

    if (!notification) {
      console.warn('⚠️ Payload sin datos de notificación');
      return;
    }

    const title = notification.title || 'Nueva notificación';
    const body = notification.body || '';
    const icon = notification.icon || '/icons/icon-192x192.png';
    const image = notification.image;

    console.log('🔔 Mostrando notificación del sistema:', { title, body });

    // Mostrar SOLO notificación del sistema usando Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.showNotification(title, {
            body: body,
            icon: icon,
            badge: '/icons/icon-72x72.png',
            image: image,
            tag: 'fcm-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200], // Patrón de vibración
            data: data || {},
            // Sonido y comportamiento nativo del sistema
            silent: false,
          });
        })
        .then(() => {
          console.log('✅ Notificación del sistema mostrada');
        })
        .catch((error) => {
          console.error('❌ Error al mostrar notificación:', error);
        });
    }

    // NO mostrar notificación in-app, solo la del sistema
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
