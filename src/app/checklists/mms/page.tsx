'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyMMSChecklistRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/checklists/installation');
  }, [router]);

  return null;
}
