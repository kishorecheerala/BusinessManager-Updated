
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';
import Card from './Card';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center shadow-2xl border-red-100 dark:border-red-900/30">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              The application encountered an unexpected error. Your data is safe in the database. Please reload to continue.
            </p>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-left mb-6 overflow-auto max-h-32">
                <code className="text-xs font-mono text-red-600 dark:text-red-400">
                    {this.state.error?.message || 'Unknown Error'}
                </code>
            </div>
            <Button onClick={this.handleReload} className="w-full justify-center">
              <RefreshCw size={18} className="mr-2" /> Reload Application
            </Button>
          </Card>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;