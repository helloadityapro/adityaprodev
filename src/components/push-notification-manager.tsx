'use client';

import * as React from 'react';
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, arrayUnion } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

/**
 * Global manager for Firebase Cloud Messaging (FCM) push notifications.
 * Handles permission requests, token registration, and background listeners.
 */
export function PushNotificationManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    const initPush = async () => {
      // 1. Request permissions
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== 'granted') {
          console.warn("User denied push notification permissions.");
          return;
        }
      }

      // 2. Create standard notification channel for Android 8+
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Aditya Pro Alerts',
        description: 'Standard notifications for PtW, Trips and Tasks',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      // 3. Register with FCM
      await PushNotifications.register();

      // 4. Listen for token and store in Firestore
      const regListener = await PushNotifications.addListener('registration', (token: Token) => {
        const userRef = doc(firestore, 'users', user.uid);
        updateDocumentNonBlocking(userRef, {
          fcmTokens: arrayUnion(token.value)
        });
      });

      // 5. Handle errors
      const errListener = await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push Registration Error: ', JSON.stringify(error));
      });

      // 6. Handle foreground notifications
      const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        toast({
          title: notification.title,
          description: notification.body,
          action: notification.data?.link ? (
            <Button 
              variant="default"
              size="sm" 
              className="h-8 rounded-sm font-bold text-[10px] uppercase px-3"
              onClick={() => router.push(notification.data.link)}
            >
              View
            </Button>
          ) : undefined
        });
      });

      // 7. Handle notification clicks (from background/closed state)
      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const link = notification.notification.data?.link;
        if (link) {
          router.push(link);
        }
      });

      return () => {
        regListener.remove();
        errListener.remove();
        receivedListener.remove();
        actionListener.remove();
      };
    };

    initPush();
  }, [user, firestore, router, toast]);

  return null; // Invisible component
}
