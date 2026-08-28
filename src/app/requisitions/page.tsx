
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Material Requisition Module entry point.
 * Redirects to the request list for tracking.
 */
export default function MaterialRequisitionsBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/requisitions/list');
  }, [router]);

  return null;
}
