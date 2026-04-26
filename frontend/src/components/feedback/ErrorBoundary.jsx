import React from 'react';
import ErrorState from './ErrorState.jsx';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Determine error type based on error characteristics
    let errorType = 'general';
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      errorType = 'network';
    } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
      errorType = 'network';
    } else if (error.message?.includes('content') || error.message?.includes('data')) {
      errorType = 'content';
    }

    return { hasError: true, error, errorType };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    const maxRetries = 3;

    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorType: 'general',
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // After max retries, do a full page reload
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const getErrorInfo = () => {
        const { errorType, error, retryCount } = this.state;

        switch (errorType) {
          case 'network':
            return {
              title: 'Connection Error',
              message: error?.message || 'Unable to connect to our servers. Please check your internet connection.',
              errorType: 'network'
            };
          case 'content':
            return {
              title: 'Content Error',
              message: error?.message || 'Unable to load content. It may be temporarily unavailable.',
              errorType: 'content'
            };
          default:
            return {
              title: retryCount > 0 ? 'Application Error' : 'Something went wrong',
              message: error?.message || 'An unexpected error occurred. Please try again.',
              errorType: 'general'
            };
        }
      };

      const errorInfo = getErrorInfo();

      return (
        <ErrorState
          {...errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export function RouteErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? error.statusText || error.message || 'Route error'
    : error?.message || 'Unexpected route error';

  return (
    <ErrorState
      title="Navigation Error"
      message={message}
      onRetry={() => window.history.back()}
    />
  );
}

export default ErrorBoundary;

