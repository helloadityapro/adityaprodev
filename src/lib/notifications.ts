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
 * Stores notifications in user-specific subcollections for better performance and security.
 */
export function sendNotification(firestore: Firestore, data: NotificationPayload) {
  // Target the user's specific notification subcollection
  return addDocumentNonBlocking(collection(firestore, 'users', data.userId, 'notifications'), {
    title: data.title,
    description: data.description,
    link: data.link,
    read: false,
    push: data.push ?? false,
    createdAt: serverTimestamp(),
  });
}
