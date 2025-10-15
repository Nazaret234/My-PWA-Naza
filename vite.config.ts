import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Asegurar que las variables de entorno se exponen correctamente
  define: {
    'import.meta.env.VITE_API_KEY': JSON.stringify(process.env.VITE_API_KEY),
    'import.meta.env.VITE_AUTH_DOMAIN': JSON.stringify(
      process.env.VITE_AUTH_DOMAIN
    ),
    'import.meta.env.VITE_PROJECT_ID': JSON.stringify(
      process.env.VITE_PROJECT_ID
    ),
    'import.meta.env.VITE_STORAGE_BUCKET': JSON.stringify(
      process.env.VITE_STORAGE_BUCKET
    ),
    'import.meta.env.VITE_MESSAGING_SENDER_ID': JSON.stringify(
      process.env.VITE_MESSAGING_SENDER_ID
    ),
    'import.meta.env.VITE_APP_ID': JSON.stringify(process.env.VITE_APP_ID),
    'import.meta.env.VITE_VAPID_KEY': JSON.stringify(
      process.env.VITE_VAPID_KEY
    ),
  },
});
