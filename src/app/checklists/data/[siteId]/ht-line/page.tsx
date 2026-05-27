'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
            <h1 className="text-lg font-black uppercase tracking-[0.2em] text-muted-foreground/60">Updating soon</h1>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
