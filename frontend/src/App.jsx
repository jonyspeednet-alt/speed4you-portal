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
