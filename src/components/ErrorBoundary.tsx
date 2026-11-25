import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyMessage = `${parsed.error} (Operation: ${parsed.operationType || 'unknown'}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // Not JSON, keep raw message
      }

      return (
        <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
          <div className="w-full max-w-lg border border-black p-6 space-y-4">
            <div className="inline-block bg-[#FFFA2A] px-2 py-1 text-xs font-bold uppercase tracking-wider text-black">
              Gompoco Sales Assistant
            </div>
            <h1 className="text-xl font-bold text-black">Unable to complete request</h1>
            <p className="text-sm text-neutral-700 leading-relaxed break-words">
              {friendlyMessage}
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
