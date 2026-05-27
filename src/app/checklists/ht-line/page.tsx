'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Clock } from 'lucide-react';

export default function HTLineChecklistPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-in fade-in duration-500">
      <Card className="max-w-md w-full rounded-sm border-primary/10 shadow-xl overflow-hidden">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-6">
          <div className="bg-primary/10 p-5 rounded-full relative">
            <Zap className="h-12 w-12 text-primary" />
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1.5 shadow-lg animate-pulse">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">HT Line Checklist</h1>
            <p className="text-muted-foreground font-medium text-sm">Our engineering team is finalizing the safety parameters and compliance requirements for High Tension line verification.</p>
          </div>

          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-6 h-10 rounded-full font-black uppercase text-xs tracking-widest">
            Updating Soon
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function Badge({ children, className, variant }: any) {
    return <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>{children}</div>;
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
