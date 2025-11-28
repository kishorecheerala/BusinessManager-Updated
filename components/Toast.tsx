
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const Toast: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { show, message, type } = state.toast;

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, dispatch]);

  if (!show) return null;

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  const icons = {
    success: <CheckCircle className="w-8 h-8 text-white mb-2" />,
    error: <AlertCircle className="w-8 h-8 text-white mb-2" />,
    info: <Info className="w-8 h-8 text-white mb-2" />,
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex items-center justify-center pointer-events-none">
      <div className={`${bgColors[type]} pointer-events-auto rounded-2xl shadow-2xl p-6 min-w-[300px] max-w-sm flex flex-col items-center justify-center text-center animate-scale-in border-2 border-white/20 backdrop-blur-xl relative`}>
        {/* Close Button */}
        <button 
          onClick={() => dispatch({ type: 'HIDE_TOAST' })}
          className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center">
          <div className="p-3 bg-white/20 rounded-full mb-3 shadow-inner">
            {icons[type]}
          </div>
          <p className="text-white font-bold text-lg leading-tight drop-shadow-md">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default Toast;
