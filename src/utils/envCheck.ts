/**
 * Utilidad para verificar variables de entorno en producción
 * Solo para debugging, eliminar en producción final
 */

export const checkEnvVars = () => {
  const vars = {
    VITE_API_KEY: import.meta.env.VITE_API_KEY,
    VITE_AUTH_DOMAIN: import.meta.env.VITE_AUTH_DOMAIN,
    VITE_PROJECT_ID: import.meta.env.VITE_PROJECT_ID,
    VITE_STORAGE_BUCKET: import.meta.env.VITE_STORAGE_BUCKET,
    VITE_MESSAGING_SENDER_ID: import.meta.env.VITE_MESSAGING_SENDER_ID,
    VITE_APP_ID: import.meta.env.VITE_APP_ID,
    VITE_VAPID_KEY: import.meta.env.VITE_VAPID_KEY,
  };

  console.group('🔍 Verificación de Variables de Entorno');

  Object.entries(vars).forEach(([key, value]) => {
    const status = value && value !== 'undefined' ? '✅' : '❌';
    console.log(
      `${status} ${key}: ${status === '✅' ? 'DEFINIDA' : 'NO DEFINIDA'}`
    );
  });

  const allDefined = Object.values(vars).every((v) => v && v !== 'undefined');

  if (allDefined) {
    console.log('✅ Todas las variables están definidas');
  } else {
    console.error('❌ Algunas variables no están definidas');
  }

  console.groupEnd();

  return allDefined;
};

// Auto-ejecutar en desarrollo
if (import.meta.env.DEV) {
  checkEnvVars();
}
