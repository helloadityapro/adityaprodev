'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkOrdersBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/work-orders/manage');
  }, [router]);

  return null;
}
