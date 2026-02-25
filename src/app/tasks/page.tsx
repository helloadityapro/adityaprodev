
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TasksBasePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks/list');
  }, [router]);

  return null;
}
