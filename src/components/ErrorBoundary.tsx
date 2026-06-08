'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, WifiOff, Database, Cpu } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    console.error(`ErrorBoundary${this.props.componentName ? ` [${this.props.componentName}]` : ''}:`, error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = this.state.error?.message || '';
      const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('NetworkError');
      const isDbError = errorMsg.includes('database') || errorMsg.includes('prisma') || errorMsg.includes('connection');

      let icon = <AlertCircle className="w-8 h-8 text-red-500" />;
      let title = 'Something went wrong';
      let description = 'This section encountered an error.';
      let hint = '';

      if (isNetworkError) {
        icon = <WifiOff className="w-8 h-8 text-amber-500" />;
        title = 'Connection issue';
        description = 'Could not reach the server.';
        hint = 'Check your internet connection and try again.';
      } else if (isDbError) {
        icon = <Database className="w-8 h-8 text-amber-500" />;
        title = 'Database error';
        description = 'Could not load data from the server.';
        hint = 'The database may be temporarily unavailable.';
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-1">{description}</p>
          {hint && <p className="text-xs text-gray-400 mb-4">{hint}</p>}
          {!hint && <p className="text-xs text-gray-400 mb-4">Try refreshing the page.</p>}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-[#1a4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d2e]/80 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
          {this.props.componentName && (
            <p className="text-[10px] text-gray-300 mt-3">Section: {this.props.componentName}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
