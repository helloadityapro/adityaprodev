import React from "react";
import { Inter } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { ClientShell } from '@/components/client-shell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <title>Aditya Pro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased font-sans">
        <FirebaseClientProvider>
          <ClientShell>{children}</ClientShell>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
