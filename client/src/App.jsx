import React, { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';
import LandingPage from './components/LandingPage.jsx';

export default function App() {
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#/platform') {
      return 'platform';
    }
    return 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined') {
        if (window.location.hash === '#/platform') {
          setView('platform');
        } else if (window.location.hash === '#/' || window.location.hash === '') {
          setView('landing');
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLaunchPlatform = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#/platform';
    }
    setView('platform');
  };

  const handleReturnToLanding = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    }
    setView('landing');
  };

  return (
    <AppProvider>
      {view === 'landing' ? (
        <LandingPage onLaunchPlatform={handleLaunchPlatform} />
      ) : (
        <Layout onReturnToLanding={handleReturnToLanding} />
      )}
    </AppProvider>
  );
}
