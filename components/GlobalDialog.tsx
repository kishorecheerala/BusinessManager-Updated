
import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import Input from './Input';

export type DialogType = 'alert' | 'confirm' | 'prompt';

export interface DialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'info';
  defaultValue?: string;
  placeholder?: string;
}

interface GlobalDialogProps {
  isOpen: boolean;
  type: DialogType;
  message: string;
  options: DialogOptions;
  onClose: (result: any) => void;
}

const GlobalDialog: React.FC<GlobalDialogProps> = ({ isOpen, type, message, options, onClose }) => {
  const [promptValue, setPromptValue] = useState(options.defaultValue || '');

  if (!isOpen) return null;

  const handleConfirm = () => {
      if (type === 'prompt') {
          onClose(promptValue);
      } else {
          onClose(true);
      }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fade-in-fast">
      <Card title={options.title} className="w-full max-w-sm animate-scale-in shadow-2xl">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">{message}</p>
          
          {type === 'prompt' && (
              <Input 
                value={promptValue} 
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={options.placeholder}
                autoFocus
              />
          )}

          <div className="flex justify-end gap-3 pt-2">
            {(type === 'confirm' || type === 'prompt') && (
                <Button onClick={() => onClose(null)} variant="secondary">
                  {options.cancelText || 'Cancel'}
                </Button>
            )}
            <Button onClick={handleConfirm} variant={options.variant || 'primary'}>
              {options.confirmText || 'OK'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GlobalDialog;
