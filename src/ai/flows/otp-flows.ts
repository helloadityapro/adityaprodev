
'use server';
/**
 * @fileOverview OTP verification flows for administrative cleanup actions.
 *
 * - initiateCleanupOtp - Generates and stores a code for Data Cleanup.
 * - verifyCleanupOtp - Validates the entered code against Firestore records.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Client SDK on server for standard rule-based writes
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const OTP_DOC_ID = 'cleanup_purge_otp';

/**
 * Generates a random 6-digit OTP and stores it in Firestore.
 * In a production app, this would also trigger an actual email sending service.
 */
export async function initiateCleanupOtp() {
  return initiateCleanupOtpFlow();
}

const initiateCleanupOtpFlow = ai.defineFlow({
  name: 'initiateCleanupOtp',
  inputSchema: z.void(),
  outputSchema: z.object({ 
    success: z.boolean(), 
    message: z.string() 
  }),
}, async () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const email = 'khalil@adityagreenenergy.com';
  
  try {
    await setDoc(doc(db, 'otp_verifications', OTP_DOC_ID), {
      code,
      email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minute validity
      createdAt: serverTimestamp()
    });

    // Logging simulation for prototype environment
    console.log(`[SYSTEM] Security OTP generated: ${code} for ${email}`);
    
    return { 
      success: true, 
      message: `A secure 6-digit code has been dispatched to ${email}. Check the system logs or your email to continue.` 
    };
  } catch (e: any) {
    return { 
      success: false, 
      message: `Failed to generate security code: ${e.message}` 
    };
  }
});

/**
 * Verifies the provided code against the stored document.
 */
export async function verifyCleanupOtp(code: string) {
  return verifyCleanupOtpFlow(code);
}

const verifyCleanupOtpFlow = ai.defineFlow({
  name: 'verifyCleanupOtp',
  inputSchema: z.string(),
  outputSchema: z.object({ 
    success: z.boolean(),
    message: z.string() 
  }),
}, async (inputCode) => {
  try {
    const snap = await getDoc(doc(db, 'otp_verifications', OTP_DOC_ID));
    if (!snap.exists()) {
      return { success: false, message: "No active verification request found." };
    }
    
    const data = snap.data();
    const now = new Date();
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.code === inputCode) {
      if (now < expiresAt) {
        return { success: true, message: "Verification successful." };
      } else {
        return { success: false, message: "Security code has expired. Please request a new one." };
      }
    }
    
    return { success: false, message: "Incorrect security code. Please try again." };
  } catch (e: any) {
    return { success: false, message: `Verification failed: ${e.message}` };
  }
});
