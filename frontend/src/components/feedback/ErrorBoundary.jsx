import React from 'react';
import ErrorState from './ErrorState.jsx';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState 
          title="Application Error"
          message={this.state.error?.message || 'Something went wrong. Please refresh.'}
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error('Route error:', error);

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

