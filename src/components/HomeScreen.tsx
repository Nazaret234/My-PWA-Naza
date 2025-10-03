import React, { useState } from 'react';
// CSS importado desde main.css

const HomeScreen: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="home-screen">
      <header className="app-header">
        <div className="header-content">
          <img src="/icons/icon-72x72.png" alt="NazaDev Logo" className="header-logo" />
          <h1>NazaDev</h1>
        </div>
      </header>

      <main className="main-content">
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
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 NazaDev - Portafolio Tecnológico</p>
      </footer>
    </div>
  );
};

export default HomeScreen;


