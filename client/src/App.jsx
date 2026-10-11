import React from 'react';
import { AppProvider } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
