import React, { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'info';
  className?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ children, variant = 'primary', className = '', type = 'button', ...props }, ref) => {
  const baseClasses = 'px-4 py-2 rounded-md font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm flex items-center justify-center gap-2 transform hover:shadow-md hover:-translate-y-px active:shadow-sm active:translate-y-0';
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-teal-700 focus:ring-primary',
    secondary: 'bg-secondary hover:bg-teal-500 focus:ring-secondary',
    danger: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
    info: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
  };

  return (
    <button ref={ref} type={type} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;