import { useState, useEffect } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType?: string;
}

export const useNetworkStatus = (): NetworkStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Conexión restaurada');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📵 Sin conexión a internet');
    };

    // Agregar event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar estado inicial
    setIsOnline(navigator.onLine);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Obtener información adicional de la conexión si está disponible
  const getConnectionType = (): string | undefined => {
    try {
      // Network Information API experimental - usar any para evitar errores de TypeScript
      const nav = navigator as any;
      const connection =
        nav.connection || nav.mozConnection || nav.webkitConnection;

      if (connection) {
        return connection.effectiveType || connection.type;
      }
    } catch (error) {
      // API no disponible en este navegador
      console.debug('Network Information API no disponible');
    }

    return undefined;
  };

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType: getConnectionType(),
  };
};
