'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function HTLineChecklistPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-in fade-in duration-500">
      <Card className="max-w-md w-full rounded-sm border-primary/10 shadow-xl overflow-hidden">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
          <h1 className="text-lg font-black uppercase tracking-[0.2em] text-muted-foreground/60">Updating soon</h1>
        </CardContent>
      </Card>
    </div>
  );
}
