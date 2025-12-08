import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, className = '', containerClassName = '', ...props }, ref) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full p-2.5 border rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
