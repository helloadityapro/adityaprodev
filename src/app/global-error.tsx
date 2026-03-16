'use client';

import { WifiOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Ultimate fallback error boundary for the entire application.
 * Required by Next.js to handle errors within the root layout.
 * This page includes its own basic layout as it sits above the RootLayout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>System Error | Aditya Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background font-sans">
          <div className="mb-6 rounded-full bg-destructive/10 p-6 text-destructive shadow-xl shadow-destructive/5">
            <WifiOff className="h-12 w-12" />
          </div>
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight">Application Failure</h2>
          <p className="mb-10 max-w-xs text-muted-foreground font-medium leading-relaxed">
            Check your Internet connection and Try again.
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
