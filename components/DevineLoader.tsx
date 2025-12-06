
import React from 'react';

const DevineLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in cursor-wait">
      <div className="relative flex items-center justify-center">
        {/* Glowing background effect - Reduced intensity */}
        <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-full transform scale-125 animate-pulse"></div>
        
        {/* The Symbol */}
        <div 
            className="relative z-10 text-[150px] sm:text-[250px] leading-none font-serif font-bold text-primary select-none filter"
            style={{ 
                animation: 'devine-pulse 3s ease-in-out infinite',
                textShadow: '0 0 30px rgba(var(--primary-color) / 0.2)'
            }}
        >
            ॐ
        </div>
      </div>
      
      {/* Loading Text */}
      <p className="mt-8 text-sm sm:text-base font-bold text-primary tracking-[0.4em] uppercase animate-pulse">
        Loading
      </p>

      {/* Inline Style for the specific breathing animation - Softer shadows */}
      <style>{`
        @keyframes devine-pulse {
            0% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 5px rgba(var(--primary-color) / 0.2)); }
            50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 25px rgba(var(--primary-color) / 0.5)); }
            100% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 5px rgba(var(--primary-color) / 0.2)); }
        }
      `}</style>
    </div>
  );
};

export default DevineLoader;
