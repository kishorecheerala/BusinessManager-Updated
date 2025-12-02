
import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

// Extend from HTMLAttributes to accept props like onClick
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, ...props }) => {
  // Use useContext directly to avoid throwing if provider is missing (e.g. inside ErrorBoundary)
  const context = useContext(AppContext);
  const state = context?.state;
  const style = state?.uiPreferences?.cardStyle || 'solid';

  let styleClasses = 'bg-white dark:bg-slate-800 shadow-md border-t-4 border-primary'; // Default Solid
  
  if (style === 'bordered') {
      styleClasses = 'bg-transparent border-2 border-slate-200 dark:border-slate-700 shadow-sm';
  } else if (style === 'glass') {
      styleClasses = 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-lg border border-white/20 dark:border-slate-700/50';
  }

  return (
    <div className={`rounded-lg p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${styleClasses} ${className}`} {...props}>
      {title && <h2 className="text-lg font-bold text-primary mb-4 border-b dark:border-slate-700 pb-2">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;
