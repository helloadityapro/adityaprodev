'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Deprecated page. Functionality has been removed.
 */
export default function AddTableConfigurationPage() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard'), [router]);
  return null;
}
