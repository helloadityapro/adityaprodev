
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExpensesBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/expenses/manage');
  }, [router]);

  return null;
}
