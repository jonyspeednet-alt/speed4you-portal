import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/feedback/ErrorBoundary.jsx';
import AppRouter from './app/router';
import './styles/global.css';

function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}

export default App;
