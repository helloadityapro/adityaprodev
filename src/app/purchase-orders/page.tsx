"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchaseOrdersBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/purchase-orders/manage');
  }, [router]);

  return null;
}
