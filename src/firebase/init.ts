'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Core initialization logic for Firebase SDKs.
 * Ensures services are only initialized once.
 */
export function getFirebaseServices() {
  let app: FirebaseApp;

  if (!getApps().length) {
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      app = initializeApp();
    } catch (e) {
      // Fallback to config object
      app = initializeApp(firebaseConfig);
    }
  } else {
    app = getApp();
  }

  // Use initializeFirestore with long polling to resolve connectivity issues in workstation environments
  let firestore: Firestore;
  try {
    firestore = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch (e) {
    // Fallback if firestore was already initialized
    firestore = getFirestore(app);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestore
  };
}
