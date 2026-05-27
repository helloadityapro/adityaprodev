'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Clock, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function HTLineDataPlaceholderPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = React.use(params);
  const router = useRouter();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/checklists/data/${siteId}`)} className="w-fit mb-2 -ml-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <Card className="max-w-md w-full rounded-sm border-primary/10 shadow-xl overflow-hidden">
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-6">
            <div className="bg-amber-500/10 p-5 rounded-full relative">
              <Zap className="h-12 w-12 text-amber-600" />
              <div className="absolute -top-1 -right-1 bg-amber-600 text-white rounded-full p-1.5 shadow-lg animate-pulse">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">HT Line Data Registry</h1>
              <p className="text-muted-foreground font-medium text-sm">We are currently migrating the High Tension transmission audit records to this project view.</p>
            </div>

            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 px-8 h-11 rounded-sm font-black uppercase text-xs tracking-widest shadow-inner">
              Updating Soon
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
