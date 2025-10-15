// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// En Vite, las variables de entorno deben tener prefijo VITE_ y usar import.meta.env

// Validar que las variables de entorno estén disponibles
const requiredEnvVars = [
  'VITE_API_KEY',
  'VITE_AUTH_DOMAIN',
  'VITE_PROJECT_ID',
  'VITE_STORAGE_BUCKET',
  'VITE_MESSAGING_SENDER_ID',
  'VITE_APP_ID',
  'VITE_VAPID_KEY',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
  console.error(
    'Asegúrate de que tu archivo .env tenga todas las variables con prefijo VITE_'
  );
} else {
  console.log(
    '✅ Todas las variables de entorno de Firebase están disponibles'
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: any = null;
try {
  messaging = getMessaging(app);
  console.log('✅ Firebase Messaging inicializado correctamente');
} catch (error) {
  console.error('❌ Error al inicializar Firebase Messaging:', error);
}

export { messaging, getToken, onMessage };
export default app;
