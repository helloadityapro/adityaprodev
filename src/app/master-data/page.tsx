'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy master-data route. 
 * Redirects to the new centralized Registries module.
 */
export default function MasterDataRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/registries/suppliers'), [router]);
  return null;
}
