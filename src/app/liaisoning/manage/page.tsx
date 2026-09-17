'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect component for the base management path.
 * Since management requires a site context, we send users back to the hub.
 */
export default function LiaisoningManageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/liaisoning/list');
  }, [router]);

  return null;
}
