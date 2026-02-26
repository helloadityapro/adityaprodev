'use server';
/**
 * @fileOverview OTP verification flows for administrative sensitive actions.
 *
 * - initiateCleanupOtp - Generates and stores a code for Data Cleanup.
 * - verifyCleanupOtp - Validates the entered code against Firestore records for Cleanup.
 * - initiatePointsOtp - Generates and stores a code for Points Adjustment.
 * - verifyPointsOtp - Validates the entered code against Firestore records for Points.
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

const CLEANUP_OTP_DOC_ID = 'cleanup_purge_otp';
const POINTS_OTP_DOC_ID = 'points_adjustment_otp';

/**
 * Generates a random 6-digit OTP and stores it in Firestore for Cleanup.
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
    await setDoc(doc(db, 'otp_verifications', CLEANUP_OTP_DOC_ID), {
      code,
      email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: serverTimestamp()
    });
    console.log(`[SECURITY] Cleanup OTP: ${code}`);
    return { success: true, message: `Code sent to ${email}.` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
});

/**
 * Verifies the provided code for Cleanup.
 */
export async function verifyCleanupOtp(code: string) {
  return verifyCleanupOtpFlow(code);
}

const verifyCleanupOtpFlow = ai.defineFlow({
  name: 'verifyCleanupOtp',
  inputSchema: z.string(),
  outputSchema: z.object({ success: z.boolean(), message: z.string() }),
}, async (inputCode) => {
  return verifyGenericOtp(CLEANUP_OTP_DOC_ID, inputCode);
});

/**
 * Generates a random 6-digit OTP and stores it in Firestore for Points.
 */
export async function initiatePointsOtp() {
  return initiatePointsOtpFlow();
}

const initiatePointsOtpFlow = ai.defineFlow({
  name: 'initiatePointsOtp',
  inputSchema: z.void(),
  outputSchema: z.object({ 
    success: z.boolean(), 
    message: z.string() 
  }),
}, async () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const email = 'khalil@adityagreenenergy.com';
  
  try {
    await setDoc(doc(db, 'otp_verifications', POINTS_OTP_DOC_ID), {
      code,
      email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: serverTimestamp()
    });
    console.log(`[SECURITY] Points Adjustment OTP: ${code}`);
    return { success: true, message: `Security code sent to ${email}.` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
});

/**
 * Verifies the provided code for Points Adjustment.
 */
export async function verifyPointsOtp(code: string) {
  return verifyPointsOtpFlow(code);
}

const verifyPointsOtpFlow = ai.defineFlow({
  name: 'verifyPointsOtp',
  inputSchema: z.string(),
  outputSchema: z.object({ success: z.boolean(), message: z.string() }),
}, async (inputCode) => {
  return verifyGenericOtp(POINTS_OTP_DOC_ID, inputCode);
});

/**
 * Internal helper to verify OTP documents.
 */
async function verifyGenericOtp(docId: string, inputCode: string) {
  try {
    const snap = await getDoc(doc(db, 'otp_verifications', docId));
    if (!snap.exists()) return { success: false, message: "No active code found." };
    
    const data = snap.data();
    const now = new Date();
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.code === inputCode) {
      if (now < expiresAt) return { success: true, message: "Verified." };
      return { success: false, message: "Code has expired." };
    }
    return { success: false, message: "Incorrect security code." };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
