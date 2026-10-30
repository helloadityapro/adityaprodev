'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Base redirect for Registries module.
 * Directs users to the Supplier Registry as the primary master data hub.
 */
export default function RegistriesBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/registries/suppliers');
  }, [router]);

  return null;
}
