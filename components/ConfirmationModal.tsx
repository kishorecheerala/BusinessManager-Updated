
import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText, cancelText, confirmVariant = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast" aria-modal="true" role="dialog">
      <Card title={title} className="w-full max-w-md animate-scale-in">
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">{children}</p>
          <div className="flex justify-end gap-4 pt-4">
            <Button onClick={onClose} variant="secondary">
              {cancelText || 'Cancel'}
            </Button>
            <Button onClick={onConfirm} variant={confirmVariant}>
              {confirmText || 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmationModal;
