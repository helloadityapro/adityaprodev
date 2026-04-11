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

    let registrationListener: any;
    let errorListener: any;
    let receivedListener: any;
    let actionListener: any;

    const initPush = async () => {
      // 1. Check/Request permissions
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }

      if (perm.receive !== 'granted') {
        console.warn("User denied push notification permissions.");
        return;
      }

      // 2. Create standard notification channel for Android 8+
      // High importance (5) is required for heads-up notifications (banners)
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Aditya Pro Alerts',
        description: 'Critical organizational alerts for PtW, Trips and Tasks',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      // 3. Setup Listeners BEFORE registration to capture the token
      registrationListener = await PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        const userRef = doc(firestore, 'users', user.uid);
        updateDocumentNonBlocking(userRef, {
          fcmTokens: arrayUnion(token.value)
        });
      });

      errorListener = await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push Registration Error: ', JSON.stringify(error));
      });

      receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // Foreground handling: Show an in-app toast
        toast({
          title: notification.title,
          description: notification.body,
          action: notification.data?.link ? (
            <Button 
              variant="default"
              size="sm" 
              className="h-8 rounded-sm font-bold text-[10px] uppercase px-3"
              onClick={() => {
                router.push(notification.data.link);
              }}
            >
              View
            </Button>
          ) : undefined
        });
      });

      actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        // Handle notification click from background/killed state
        const link = notification.notification.data?.link;
        if (link) {
          router.push(link);
        }
      });

      // 4. Finally, Register with FCM service
      await PushNotifications.register();
    };

    initPush();

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
      receivedListener?.remove();
      actionListener?.remove();
    };
  }, [user, firestore, router, toast]);

  return null; // Invisible component
}
