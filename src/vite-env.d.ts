/// <reference types="vite/client" />

// Extender tipos de NotificationOptions para incluir propiedades modernas
interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface NotificationOptions {
  actions?: NotificationAction[];
  badge?: string;
  data?: any;
  dir?: 'auto' | 'ltr' | 'rtl';
  icon?: string;
  image?: string;
  lang?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  timestamp?: number;
  vibrate?: number[];
}
