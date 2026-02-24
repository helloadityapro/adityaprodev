"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DPRPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect the base /dpr path to the new submission page
    router.replace('/dpr/submit');
  }, [router]);

  return null;
}
