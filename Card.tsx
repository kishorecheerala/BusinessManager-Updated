import React from 'react';

// Extend from HTMLAttributes to accept props like onClick
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, ...props }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6 border-t-4 border-primary transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${className}`} {...props}>
      {title && <h2 className="text-lg font-bold text-primary mb-4 border-b dark:border-slate-700 pb-2">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;