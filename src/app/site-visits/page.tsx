
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function SiteVisitsBasePage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'Site Manager') {
        router.replace('/site-visits/active');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [userProfile, router]);

  return null;
}
