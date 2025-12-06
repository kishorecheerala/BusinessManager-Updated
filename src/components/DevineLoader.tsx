
import React from 'react';

const DevineLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in cursor-wait">
      <div className="relative flex items-center justify-center">
        {/* The Symbol */}
        <div 
            className="relative z-10 text-[180px] sm:text-[300px] leading-none font-serif font-bold text-primary select-none filter"
            style={{ 
                animation: 'devine-pulse 3s ease-in-out infinite',
                textShadow: '0 0 40px rgba(var(--primary-color) / 0.3)'
            }}
        >
            ॐ
        </div>
      </div>

      {/* Inline Style for the specific breathing animation */}
      <style>{`
        @keyframes devine-pulse {
            0% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 5px rgba(var(--primary-color) / 0.2)); }
            50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 30px rgba(var(--primary-color) / 0.6)); }
            100% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 5px rgba(var(--primary-color) / 0.2)); }
        }
      `}</style>
    </div>
  );
};

export default DevineLoader;