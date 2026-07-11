'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Base redirect for Registries module.
 */
export default function RegistriesBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/registries/tables/list');
  }, [router]);

  return null;
}
