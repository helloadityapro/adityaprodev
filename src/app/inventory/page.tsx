"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventoryBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect the base /inventory path to Global Inventory view
    router.replace('/inventory/global');
  }, [router]);

  return null;
}
