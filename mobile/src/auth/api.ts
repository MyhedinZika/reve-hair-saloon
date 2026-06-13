import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { UserDoc } from '@salon/shared';
import { auth, firestore } from '../config/firebase';

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  phone: string | null = null,
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user.uid, {
    displayName,
    email: cred.user.email,
    phone,
  });
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  await ensureUserProfile(result.user.uid, {
    displayName: result.user.displayName ?? 'New Client',
    email: result.user.email,
    phone: result.user.phoneNumber,
  });
}

interface EnsureProfileInput {
  displayName: string;
  email: string | null;
  phone: string | null;
}

async function ensureUserProfile(uid: string, input: EnsureProfileInput): Promise<void> {
  const ref = doc(firestore, 'users', uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  const profile: UserDoc = {
    uid,
    role: 'client',
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    fcmToken: null,
    createdAt: Date.now(),
  };
  await setDoc(ref, profile);
  void serverTimestamp;
}
