
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Base redirect for Master Data module.
 */
export default function MasterDataBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master-data/tables/list');
  }, [router]);

  return null;
}
