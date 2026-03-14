import React from "react";
import { Inter } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { ClientShell } from '@/components/client-shell';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import type { Metadata } from "next";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
      <body className="antialiased font-sans min-h-screen">
        <FirebaseClientProvider>
          <FirebaseErrorListener />
          <ClientShell>{children}</ClientShell>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
