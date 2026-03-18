'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

// Module-level singletons to ensure only one instance of each service exists.
let cachedApp: FirebaseApp | undefined;
let cachedFirestore: Firestore | undefined;
let cachedAuth: Auth | undefined;

/**
 * Core initialization logic for Firebase SDKs.
 * Uses forced long polling to resolve connectivity issues in workstation and proxy environments.
 */
export function getFirebaseServices() {
  if (!cachedApp) {
    if (!getApps().length) {
      try {
        // Attempt to initialize via Firebase App Hosting environment variables
        cachedApp = initializeApp();
      } catch (e) {
        // Fallback to config object
        cachedApp = initializeApp(firebaseConfig);
      }
    } else {
      cachedApp = getApp();
    }
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }

  if (!cachedFirestore) {
    // Use forced long polling to ensure reliability in proxied environments (e.g. Cloud Workstations)
    // This prevents the "Could not reach Cloud Firestore backend" 10s timeout error.
    try {
      cachedFirestore = initializeFirestore(cachedApp, {
        experimentalForceLongPolling: true,
        useFetchStreams: false
      });
    } catch (e) {
      // Fallback if firestore was already initialized
      cachedFirestore = getFirestore(cachedApp);
    }
  }

  return {
    firebaseApp: cachedApp,
    auth: cachedAuth,
    firestore: cachedFirestore
  };
}
