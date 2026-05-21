"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChecklistsBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the point-based Table Level MMS checklist
    router.replace('/checklists/installation');
  }, [router]);

  return null;
}
