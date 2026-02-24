
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RequirementsBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect the base /requirements path to the submission page
    router.replace('/requirements/submit');
  }, [router]);

  return null;
}
