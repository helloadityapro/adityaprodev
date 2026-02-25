
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MaterialMovementBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/movements/record');
  }, [router]);

  return null;
}
