
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChecklistsBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/checklists/mms');
  }, [router]);

  return null;
}
