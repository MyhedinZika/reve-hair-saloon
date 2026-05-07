import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Role, UserDoc } from '@salon/shared';
import { collections } from './db';

export interface CallerContext {
  uid: string;
  role: Role;
  user: UserDoc;
}

export async function requireCaller(request: CallableRequest<unknown>): Promise<CallerContext> {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = request.auth.uid;
  const snap = await collections.users().doc(uid).get();
  const user = snap.data();
  if (!user) {
    throw new HttpsError('failed-precondition', 'User profile not found.');
  }
  return { uid, role: user.role, user };
}

export async function requireRole(
  request: CallableRequest<unknown>,
  roles: Role[],
): Promise<CallerContext> {
  const ctx = await requireCaller(request);
  if (!roles.includes(ctx.role)) {
    throw new HttpsError('permission-denied', `Requires role: ${roles.join(' or ')}.`);
  }
  return ctx;
}
