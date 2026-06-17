import type { TranslationKey } from '../i18n/I18nContext';

const authErrorKeys: Record<string, TranslationKey> = {
  'auth/email-already-in-use': 'emailAlreadyInUse',
  'auth/invalid-credential': 'invalidLoginCredentials',
  'auth/invalid-email': 'invalidEmail',
  'auth/user-not-found': 'invalidLoginCredentials',
  'auth/wrong-password': 'invalidLoginCredentials',
  'auth/too-many-requests': 'tooManyRequests',
};

export function getAuthErrorMessage(
  err: unknown,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
): string {
  const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
  return t(authErrorKeys[code] ?? fallbackKey);
}
