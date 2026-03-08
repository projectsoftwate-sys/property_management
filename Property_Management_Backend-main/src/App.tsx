import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';

type AuthScreen = 'login' | 'signup';

function AppContent() {
  const { user, loading } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return authScreen === 'login' ? (
    <Login onNavigateToSignUp={() => setAuthScreen('signup')} />
  ) : (
    <SignUp onNavigateToSignIn={() => setAuthScreen('login')} />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
