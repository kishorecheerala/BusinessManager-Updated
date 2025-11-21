
import React from 'react';
import Card from './Card';
import Button from './Button';

export type DialogType = 'alert' | 'confirm';

export interface DialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'info';
}

interface GlobalDialogProps {
  isOpen: boolean;
  type: DialogType;
  message: string;
  options: DialogOptions;
  onClose: (result: boolean) => void;
}

const GlobalDialog: React.FC<GlobalDialogProps> = ({ isOpen, type, message, options, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
      <Card title={options.title} className="w-full max-w-md animate-scale-in shadow-2xl">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">{message}</p>
          <div className="flex justify-end gap-3 pt-2">
            {type === 'confirm' && (
                <Button onClick={() => onClose(false)} variant="secondary">
                {options.cancelText || 'Cancel'}
                </Button>
            )}
            <Button onClick={() => onClose(true)} variant={options.variant || 'primary'}>
              {options.confirmText || 'OK'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GlobalDialog;
