import { Component } from 'react';
import * as Sentry from '@sentry/react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };
  isRecovering = false;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRecover = () => {
    if (this.isRecovering) return;
    this.isRecovering = true;
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.isRecovering) return null;
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-[#1A1614] mb-4">Something went wrong</h1>
            <p className="text-[#6B635A] mb-8">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={this.handleRecover}
              className="bg-[#1B6B5A] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#155a4a] transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
