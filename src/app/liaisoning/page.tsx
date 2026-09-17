
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiaisoningBasePage() {
  const router = useRouter();
  useEffect(() => router.replace('/liaisoning/list'), [router]);
  return null;
}
