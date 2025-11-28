
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
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-white" />,
    error: <AlertCircle className="w-6 h-6 text-white" />,
    info: <Info className="w-6 h-6 text-white" />,
  };

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] animate-scale-in w-[90%] max-w-sm">
      <div className={`${bgColors[type]} rounded-xl shadow-2xl p-5 flex items-center justify-between pointer-events-auto border-2 border-white/20 backdrop-blur-md`}>
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/20 rounded-full">
            {icons[type]}
          </div>
          <p className="text-white font-bold text-base leading-tight drop-shadow-sm">{message}</p>
        </div>
        <button 
          onClick={() => dispatch({ type: 'HIDE_TOAST' })}
          className="text-white/70 hover:text-white transition-colors p-1"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
