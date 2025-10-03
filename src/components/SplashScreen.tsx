import React from 'react';
// CSS importado desde main.css

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      color: 'white',
      flexDirection: 'column'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#00d4ff', fontSize: '3rem', marginBottom: '1rem' }}>
          NazaDev
        </h1>
        <p style={{ color: '#b8c0c8', fontSize: '1.2rem', marginBottom: '2rem' }}>
          Portafolio Tecnológico
        </p>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(0, 212, 255, 0.3)',
          borderTop: '3px solid #00d4ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }}></div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;


