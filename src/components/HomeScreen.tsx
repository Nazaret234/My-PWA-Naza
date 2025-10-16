import React, { useState } from 'react';
import ActivityForm from './ActivityForm';
import ActivityListPage from './ActivityListPage';
import NetworkStatusIndicator from './NetworkStatusIndicator';
import BackgroundSyncStatus from './BackgroundSyncStatus';
import PushNotificationManager from './PushNotificationManager';
// CSS importado desde main.css

const HomeScreen: React.FC = () => {
  const [count, setCount] = useState(0);
  const [currentView, setCurrentView] = useState<'home' | 'activities'>('home');

  return (
    <div className="home-screen">
      <NetworkStatusIndicator />
      <header className="app-header">
        <div className="header-content">
          <img src="/icons/icon-72x72.png" alt="NazaDev Logo" className="header-logo" />
          <h1>NazaDev</h1>
          
          {/* Navigation buttons */}
          <div className="nav-buttons">
            <button
              className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              🏠 Inicio
            </button>
            <button
              className={`nav-btn ${currentView === 'activities' ? 'active' : ''}`}
              onClick={() => setCurrentView('activities')}
            >
              📋 Ver Todas
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'home' ? (
          <>
            <section className="welcome-section">
              <h2>¡Bienvenido a NazaDev!</h2>
              <p>Portafolio de desarrollo tecnológico con enfoque en aplicaciones web modernas.</p>
            </section>

            <section className="features-section">
              <div className="feature-card">
                <div className="feature-icon">💻</div>
                <h3>Frontend</h3>
                <p>React, TypeScript, PWAs y tecnologías web modernas</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Performance</h3>
                <p>Optimización avanzada con Service Workers y caché inteligente</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <h3>Innovación</h3>
                <p>Soluciones tecnológicas creativas y experiencias de usuario únicas</p>
              </div>
            </section>

            <ActivityForm onActivityAdded={() => {
              // Opcional: refrescar lista si está en vista de actividades
              console.log('Nueva actividad agregada');
            }} />

            <BackgroundSyncStatus />

            <PushNotificationManager 
              onTokenReceived={(token) => {
                console.log('✅ Token FCM configurado correctamente');
                // Aquí puedes enviar el token a tu backend si es necesario
              }}
            />

            <section className="interactive-section">
              <div className="counter-card">
                <h3>Contador Interactivo</h3>
                <div className="counter-display">
                  <span className="counter-value">{count}</span>
                </div>
                <div className="counter-buttons">
                  <button 
                    className="counter-btn decrease" 
                    onClick={() => setCount(count - 1)}
                    aria-label="Decrementar contador"
                  >
                    -
                  </button>
                  <button 
                    className="counter-btn reset" 
                    onClick={() => setCount(0)}
                    aria-label="Resetear contador"
                  >
                    Reset
                  </button>
                  <button 
                    className="counter-btn increase" 
                    onClick={() => setCount(count + 1)}
                    aria-label="Incrementar contador"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <ActivityListPage />
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 NazaDev - Portafolio Tecnológico</p>
      </footer>
    </div>
  );
};

export default HomeScreen;


