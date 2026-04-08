import React from "react";
import { Inter } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { PushNotificationManager } from '@/components/push-notification-manager';
import type { Metadata } from "next";
import dynamic from 'next/dynamic';

// Dynamically import the heavy ClientShell to prevent main layout chunk timeouts and optimize loading.
const ClientShell = dynamic(() => import('@/components/client-shell').then(mod => mod.ClientShell), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Shell...</p>
      </div>
    </div>
  )
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Aditya Pro",
  description: "Enterprise Asset Management and Permit to Work System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased font-sans h-full" suppressHydrationWarning>
        <FirebaseClientProvider>
          <FirebaseErrorListener />
          <PushNotificationManager />
          <ClientShell>{children}</ClientShell>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
