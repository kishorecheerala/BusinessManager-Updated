
import React from 'react';

const DevineLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl animate-fade-in cursor-wait">
      <div className="relative flex items-center justify-center mb-10">
        {/* Subtle background ambiance - drastically reduced opacity */}
        <div className="absolute inset-0 bg-primary/5 blur-[60px] rounded-full animate-pulse"></div>
        
        {/* The Symbol */}
        <div 
            className="relative z-10 text-[120px] sm:text-[180px] leading-none font-serif font-bold text-primary select-none"
            style={{ 
                animation: 'devine-pulse 3s ease-in-out infinite',
                // Very subtle static shadow for depth, not glow
                textShadow: '0 4px 10px rgba(0,0,0,0.1)' 
            }}
        >
            ॐ
        </div>
      </div>

      {/* Loading Indicators */}
      <div className="flex flex-col items-center gap-3 z-10 w-48 sm:w-64">
        <p className="text-xs font-bold text-primary/60 tracking-[0.3em] uppercase animate-pulse">
            Loading...
        </p>
        
        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/40 to-primary w-full origin-left animate-progress-indeterminate"></div>
        </div>
      </div>

      {/* Inline Style for animations */}
      <style>{`
        @keyframes devine-pulse {
            0% { 
                transform: scale(0.95); 
                opacity: 0.85; 
                /* Very subtle shadow instead of intense glow */
                filter: drop-shadow(0 0 2px rgba(var(--primary-color) / 0.1)); 
            }
            50% { 
                transform: scale(1.05); 
                opacity: 1; 
                /* Reduced glow peak: smaller blur radius, lower opacity */
                filter: drop-shadow(0 0 12px rgba(var(--primary-color) / 0.3)); 
            }
            100% { 
                transform: scale(0.95); 
                opacity: 0.85; 
                filter: drop-shadow(0 0 2px rgba(var(--primary-color) / 0.1)); 
            }
        }
        @keyframes progress-indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
        }
        .animate-progress-indeterminate {
            animation: progress-indeterminate 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default DevineLoader;
