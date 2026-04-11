/**
 * @fileOverview Firebase Cloud Function to dispatch true Push Notifications via FCM.
 * This script monitors the 'notifications' collection and sends messages
 * to all registered device tokens for the target user.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.dispatchPushNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
  const data = event.data.data();
  
  // Only process if the 'push' flag is explicitly true
  if (!data.push) {
    console.log("Notification logged as in-app only (no push flag).");
    return;
  }

  const userId = data.userId;
  const db = getFirestore();
  const messaging = getMessaging();

  try {
    // 1. Fetch the user's registered FCM tokens
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error(`User ${userId} not found.`);
      return;
    }

    const userData = userDoc.data();
    const tokens = userData.fcmTokens || [];

    if (tokens.length === 0) {
      console.log(`No FCM tokens registered for user ${userId}.`);
      return;
    }

    // 2. Prepare the FCM payload optimized for background/killed state delivery
    // We include both 'notification' (for OS handling) and 'data' (for app handling)
    const messagePayload = {
      notification: {
        title: String(data.title),
        body: String(data.description),
      },
      data: {
        link: String(data.link || "/"),
        notificationId: String(event.params.notificationId)
      },
      android: {
        priority: 'high', // Critical for background/killed state delivery
        notification: {
          channelId: 'default',
          priority: 'max', // Heads-up priority for Android
          visibility: 'public',
          sound: 'default',
          clickAction: 'FCM_PLUGIN_ACTIVITY' // Ensures intent triggers correctly
        }
      },
      apns: {
        headers: {
          'apns-priority': '10', // Critical for immediate delivery on iOS
        },
        payload: {
          aps: {
            alert: {
              title: String(data.title),
              body: String(data.description)
            },
            sound: 'default',
            badge: 1,
            contentAvailable: true // Critical for background "wake up"
          }
        }
      },
      // Target multiple tokens (multicast)
      tokens: Array.from(new Set(tokens)), // Ensure unique tokens
    };

    // 3. Send via FCM
    const response = await messaging.sendEachForMulticast(messagePayload);
    
    // 4. Cleanup invalid tokens atomically if any (e.g. user uninstalled app)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error.code;
          // Clean up tokens that are definitely invalid/expired
          if (errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered') {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.log(`Cleaning up ${failedTokens.length} expired tokens for user ${userId} atomically.`);
        await db.collection("users").doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(...failedTokens)
        });
      }
    }

    console.log(`Successfully dispatched push to ${response.successCount} devices for user ${userId}.`);
  } catch (error) {
    console.error("Critical FCM dispatch error:", error);
  }
});
