'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignedVehiclesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new unified Manage Trips dashboard
    router.replace('/vehicles/trips/manage');
  }, [router]);

  return null;
}
