'use client';

import { AppProvider as PolarisProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';
import { useEffect } from 'react';
import { getAppBridge } from '@/lib/appBridge';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Initialize App Bridge when component mounts
  useEffect(() => {
    // Initialize App Bridge for embedded app
    const app = getAppBridge();
    if (app) {
      // App Bridge is now initialized and will handle redirects automatically
      console.log('[App Bridge] Initialized successfully');
    }
  }, []);

  return (
    <PolarisProvider i18n={en}>
      {children}
    </PolarisProvider>
  );
}

