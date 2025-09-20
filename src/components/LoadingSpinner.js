import React from 'react';

const LoadingSpinner = () => {
  return (
    <div 
      className="d-flex flex-column justify-content-center align-items-center" 
      style={{ 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      {/* Animated Logo */}
      <div 
        className="mb-4"
        style={{
          width: '100px',
          height: '100px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          borderRadius: '25px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          animation: 'pulse 2s infinite'
        }}
      >
        <i className="fas fa-graduation-cap" style={{ 
          fontSize: '3rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}></i>
      </div>

      {/* Loading Spinner */}
      <div className="mb-3">
        <div 
          className="spinner-border text-white" 
          role="status"
          style={{ 
            width: '3rem', 
            height: '3rem',
            borderWidth: '4px'
          }}
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>

      {/* Loading Text */}
      <h4 className="text-white mb-2 fw-semibold">Loading...</h4>
      <p className="text-white-50 mb-0">Setting up your dashboard</p>
      
      {/* Skip button for slow connections */}
      <div className="mt-4">
        <button 
          className="btn btn-outline-light btn-sm"
          onClick={() => window.location.href = '/login'}
          style={{ borderRadius: '8px' }}
        >
          Skip to Login
        </button>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
