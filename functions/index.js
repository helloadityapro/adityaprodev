/**
 * @fileOverview Firebase Cloud Function to dispatch true Push Notifications via FCM.
 * Updated to support per-user notification subcollections.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.dispatchPushNotification = onDocumentCreated("users/{userId}/notifications/{notificationId}", async (event) => {
  const data = event.data.data();
  const userId = event.params.userId;
  
  // Only process if the 'push' flag is explicitly true
  if (!data.push) {
    console.log(`Notification for ${userId} logged as in-app only (no push flag).`);
    return;
  }

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
        priority: 'high',
        notification: {
          channelId: 'default',
          priority: 'max',
          visibility: 'public',
          sound: 'default',
          clickAction: 'FCM_PLUGIN_ACTIVITY'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            alert: {
              title: String(data.title),
              body: String(data.description)
            },
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      },
      tokens: Array.from(new Set(tokens)),
    };

    // 3. Send via FCM
    const response = await messaging.sendEachForMulticast(messagePayload);
    
    // 4. Cleanup invalid tokens atomically if any
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error.code;
          if (errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered') {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.log(`Cleaning up ${failedTokens.length} expired tokens for user ${userId}.`);
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
