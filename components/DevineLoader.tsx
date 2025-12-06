
import React from 'react';

const DevineLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl animate-fade-in cursor-wait">
      <div className="relative flex items-center justify-center mb-8">
        {/* Subtle background ambiance - drastically reduced opacity */}
        <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-full animate-pulse"></div>
        
        {/* The Symbol - Set to 250px */}
        <div 
            className="relative z-10 text-[250px] leading-none font-serif font-bold text-primary select-none"
            style={{ 
                animation: 'devine-pulse 3s ease-in-out infinite',
                // Very subtle static shadow for depth, minimal glow
                textShadow: '0 4px 10px rgba(0,0,0,0.05)' 
            }}
        >
            ॐ
        </div>
      </div>

      {/* Loading Indicators */}
      <div className="flex flex-col items-center gap-4 z-10 w-64">
        <p className="text-lg font-bold text-primary/80 tracking-widest uppercase flex items-end gap-1">
            Loading
            <span className="loading-dot dot-1">.</span>
            <span className="loading-dot dot-2">.</span>
            <span className="loading-dot dot-3">.</span>
        </p>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/40 to-primary w-full origin-left animate-progress-indeterminate"></div>
        </div>
      </div>

      {/* Inline Style for animations */}
      <style>{`
        @keyframes devine-pulse {
            0% { 
                transform: scale(0.95); 
                opacity: 0.85; 
                filter: drop-shadow(0 0 2px rgba(var(--primary-color) / 0.1)); 
            }
            50% { 
                transform: scale(1.05); 
                opacity: 1; 
                filter: drop-shadow(0 0 10px rgba(var(--primary-color) / 0.25)); 
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
        @keyframes dot-flash {
            0%, 100% { opacity: 0.2; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-3px); }
        }
        .loading-dot {
            display: inline-block;
            animation: dot-flash 1.4s infinite both;
        }
        .dot-1 { animation-delay: -0.32s; }
        .dot-2 { animation-delay: -0.16s; }
        .dot-3 { animation-delay: 0s; }
      `}</style>
    </div>
  );
};

export default DevineLoader;
