
import React from 'react';

const DevineLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl animate-fade-in cursor-wait">
      <div className="relative flex items-center justify-center mb-8">
        {/* Subtle background ambiance */}
        <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full animate-pulse"></div>
        
        {/* The Symbol */}
        <div 
            className="relative z-10 text-[200px] leading-none font-serif font-bold text-primary select-none"
            style={{ 
                animation: 'devine-pulse 4s ease-in-out infinite',
            }}
        >
            ॐ
        </div>
      </div>

      {/* Loading Indicators */}
      <div className="flex flex-col items-center gap-4 z-10 w-64">
        <div className="text-lg font-bold text-primary/80 tracking-widest uppercase flex items-end leading-none h-6">
            LOADING
            <div className="flex ml-1 mb-1">
                <span className="animate-dot-1 mx-[1px]">.</span>
                <span className="animate-dot-2 mx-[1px]">.</span>
                <span className="animate-dot-3 mx-[1px]">.</span>
            </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/40 to-primary w-full origin-left animate-progress-indeterminate"></div>
        </div>
      </div>

      {/* Inline Style for animations */}
      <style>{`
        @keyframes devine-pulse {
            0% { 
                transform: scale(0.9); 
                opacity: 0.8; 
                text-shadow: 0 0 20px rgb(var(--primary-color) / 0.5);
            }
            50% { 
                transform: scale(1.1); 
                opacity: 1; 
                text-shadow: 
                    0 0 30px rgb(var(--primary-color) / 0.8),
                    0 0 60px rgb(var(--primary-color) / 0.6),
                    0 0 90px rgb(var(--primary-color) / 0.4);
            }
            100% { 
                transform: scale(0.9); 
                opacity: 0.8; 
                text-shadow: 0 0 20px rgb(var(--primary-color) / 0.5);
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
        /* Dot Animation */
        @keyframes dot-bounce {
            0%, 100% { opacity: 0.2; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-4px); }
        }
        .animate-dot-1 { animation: dot-bounce 1.4s infinite both; animation-delay: 0s; }
        .animate-dot-2 { animation: dot-bounce 1.4s infinite both; animation-delay: 0.2s; }
        .animate-dot-3 { animation: dot-bounce 1.4s infinite both; animation-delay: 0.4s; }
      `}</style>
    </div>
  );
};

export default DevineLoader;
