'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect component for legacy "Manage Sites" path.
 * Functionality moved to /projects/add as "Add New Project".
 */
export default function ManageSitesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/projects/add');
  }, [router]);

  return null;
}
