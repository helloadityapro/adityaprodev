'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCcw, AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Standard Next.js error boundary for the application segment.
 * Handles network failures and unexpected runtime errors with requested specific messaging.
 */
export default function Error({
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

    console.error("Aditya Pro Runtime Error:", error);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const errorMessage = error.message?.toLowerCase() || '';
  const isNetworkRelated = 
    isOffline || 
    errorMessage.includes('network') || 
    errorMessage.includes('fetch') ||
    errorMessage.includes('failed to load') ||
    errorMessage.includes('not available') ||
    errorMessage.includes('err_internet_disconnected');

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
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

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button 
          onClick={() => reset()} 
          className="h-14 rounded-sm font-black uppercase text-sm shadow-xl shadow-primary/20"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button 
          variant="outline" 
          asChild
          className="h-12 rounded-sm font-bold text-xs uppercase border-primary/20 text-primary"
        >
          <Link href="/"><Home className="mr-2 h-3.5 w-3.5" /> Return to Home</Link>
        </Button>
      </div>
      
      {error.digest && (
        <div className="mt-12 space-y-1 opacity-20 select-all">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Error Hash</p>
          <p className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-sm">{error.digest}</p>
        </div>
      )}
    </div>
  );
}
