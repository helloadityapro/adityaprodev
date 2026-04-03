
'use client';

import { collection, serverTimestamp, Firestore } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase';

export interface NotificationPayload {
  userId: string;
  title: string;
  description: string;
  link: string;
  push?: boolean;
}

/**
 * Standard utility to send notifications within the Aditya Pro ecosystem.
 * This helper writes to Firestore, which then triggers a Cloud Function
 * to dispatch a real push notification if the 'push' flag is true.
 */
export function sendNotification(firestore: Firestore, data: NotificationPayload) {
  return addDocumentNonBlocking(collection(firestore, 'notifications'), {
    ...data,
    read: false,
    push: data.push ?? false,
    createdAt: serverTimestamp(),
  });
}
