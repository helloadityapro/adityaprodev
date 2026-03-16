'use client';

import * as React from 'react';
import { WifiOff, RefreshCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Ultimate fallback error boundary for the entire application.
 * Specifically detects 'net::ERR_INTERNET_DISCONNECTED' and internal application errors.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const errorMessage = error.message?.toLowerCase() || '';
  const isNetworkRelated = 
    isOffline || 
    errorMessage.includes('network') || 
    errorMessage.includes('fetch') ||
    errorMessage.includes('failed to load') ||
    errorMessage.includes('not available') ||
    errorMessage.includes('err_internet_disconnected');

  return (
    <html lang="en">
      <head>
        <title>System Error | Aditya Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background font-sans">
          <div className={cn(
            "mb-6 rounded-full p-6 shadow-xl",
            isNetworkRelated ? "bg-amber-500/10 text-amber-600 shadow-amber-500/5" : "bg-destructive/10 text-destructive shadow-destructive/5"
          )}>
            {isNetworkRelated ? (
              <WifiOff className="h-12 w-12" />
            ) : (
              <AlertCircle className="h-12 w-12" />
            )}
          </div>
          
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight">
            {isNetworkRelated ? 'Connection Error' : 'Application Error'}
          </h2>
          
          <p className="mb-10 max-w-xs text-muted-foreground font-medium leading-relaxed">
            {isNetworkRelated 
              ? "Check your Internet connection and Try again."
              : "We’re giving this a quick repair. Please try again after a short while."
            }
          </p>

          <Button 
            onClick={() => reset()} 
            className="h-14 w-full max-w-xs rounded-sm font-black uppercase text-sm shadow-xl shadow-primary/20 bg-primary text-primary-foreground"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <div className="mt-12 opacity-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Aditya Pro Error Handler</p>
          </div>
        </div>
      </body>
    </html>
  );
}
