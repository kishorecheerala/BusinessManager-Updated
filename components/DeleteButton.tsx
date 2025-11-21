import React from 'react';
import { Trash2, XCircle } from 'lucide-react';

interface DeleteButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'delete' | 'remove';
}

const DeleteButton: React.FC<DeleteButtonProps> = ({ variant = 'delete', ...props }) => {
  const Icon = variant === 'delete' ? Trash2 : XCircle;
  
  return (
    <button
      className="p-2 rounded-full text-red-700 hover:bg-red-200/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex-shrink-0"
      aria-label={variant === 'delete' ? 'Delete item' : 'Remove item'}
      {...props}
    >
      <Icon size={16} />
    </button>
  );
};

export default DeleteButton;