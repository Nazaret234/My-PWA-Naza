import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  updateAvailable: boolean;
  isOffline: boolean;
}

export const useServiceWorker = () => {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    updateAvailable: false,
    isOffline: !navigator.onLine,
  });

  useEffect(() => {
    if (!state.isSupported) {
      console.log('Service Worker no es soportado en este navegador');
      return;
    }

    // Registrar Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('Service Worker registrado exitosamente:', registration);

        setState((prev) => ({ ...prev, isRegistered: true }));

        // Escuchar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                setState((prev) => ({ ...prev, updateAvailable: true }));
              }
            });
          }
        });

        // Escuchar mensajes del Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
            setState((prev) => ({ ...prev, updateAvailable: true }));
          }
        });
      } catch (error) {
        console.error('Error al registrar Service Worker:', error);
      }
    };

    registerSW();

    // Escuchar cambios de conectividad
    const handleOnline = () =>
      setState((prev) => ({ ...prev, isOffline: false }));
    const handleOffline = () =>
      setState((prev) => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isSupported]);

  const updateServiceWorker = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    ...state,
    updateServiceWorker,
  };
};
