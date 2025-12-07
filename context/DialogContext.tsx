
import React, { createContext, useContext, useState, useCallback } from 'react';
import GlobalDialog, { DialogOptions, DialogType } from '../components/GlobalDialog';

interface DialogContextType {
  showConfirm: (message: string, options?: Partial<DialogOptions>) => Promise<boolean>;
  showAlert: (message: string, options?: Partial<DialogOptions>) => Promise<void>;
  showPrompt: (message: string, defaultValue?: string, options?: Partial<DialogOptions>) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: DialogType;
    message: string;
    options: DialogOptions;
    resolve: (value: any) => void;
  } | null>(null);

  const showConfirm = useCallback((message: string, options?: Partial<DialogOptions>) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        message,
        options: { title: 'Confirm', confirmText: 'Confirm', cancelText: 'Cancel', variant: 'danger', ...options },
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((message: string, options?: Partial<DialogOptions>) => {
    return new Promise<void>((resolve) => {
      setDialog({
        isOpen: true,
        type: 'alert',
        message,
        options: { title: 'Alert', confirmText: 'OK', variant: 'primary', ...options },
        resolve,
      });
    });
  }, []);

  const showPrompt = useCallback((message: string, defaultValue?: string, options?: Partial<DialogOptions>) => {
    return new Promise<string | null>((resolve) => {
        setDialog({
            isOpen: true,
            type: 'prompt',
            message,
            options: { title: 'Input Required', confirmText: 'Submit', cancelText: 'Cancel', defaultValue, ...options },
            resolve
        });
    });
  }, []);

  const handleClose = (result: any) => {
    if (dialog) {
      dialog.resolve(result);
      setDialog(null);
    }
  };

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert, showPrompt }}>
      {children}
      {dialog && (
        <GlobalDialog
          isOpen={dialog.isOpen}
          type={dialog.type}
          message={dialog.message}
          options={dialog.options}
          onClose={handleClose}
        />
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within a DialogProvider');
  return context;
};
