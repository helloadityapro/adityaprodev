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
      // High importance (5) is required for heads-up notifications (banners)
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Aditya Pro Alerts',
        description: 'Standard notifications for PtW, Trips and Tasks',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      // 3. Setup Listeners FIRST to avoid race conditions with registration
      
      // Token listener: fires when registration completes
      const regListener = await PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        const userRef = doc(firestore, 'users', user.uid);
        updateDocumentNonBlocking(userRef, {
          fcmTokens: arrayUnion(token.value)
        });
      });

      // Error listener
      const errListener = await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push Registration Error: ', JSON.stringify(error));
      });

      // Foreground listener: fires when a notification arrives while app is open
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

      // Action listener: fires when user clicks a notification (from background or killed state)
      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const link = notification.notification.data?.link;
        if (link) {
          router.push(link);
        }
      });

      // 4. Finally, Register with FCM service
      await PushNotifications.register();

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
