'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Legacy Site Activities page. 
 * Functional context has been consolidated into the Project Command Center (/projects/[projectId]).
 * This page now performs a transparent redirect.
 */
export default function SiteActivitiesRedirect() {
  const router = useRouter();
  const params = useParams();
  const siteId = params?.siteId;

  useEffect(() => {
    if (siteId) {
      router.replace(`/projects/${siteId}`);
    } else {
      router.replace('/projects/list');
    }
  }, [siteId, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Directing to Command Center...</p>
      </div>
    </div>
  );
}