import { useEffect, useRef, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { googleAndroidClientId, googleIosClientId, googleWebClientId } from '../config/env';
import { signInWithGoogleIdToken } from './api';

WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInState {
  ready: boolean;
  error: unknown | null;
  signingIn: boolean;
  prompt: () => Promise<void>;
  resetError: () => void;
}

export function useGoogleSignIn(): GoogleSignInState {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId,
    ...(googleIosClientId ? { iosClientId: googleIosClientId } : {}),
    ...(googleAndroidClientId ? { androidClientId: googleAndroidClientId } : {}),
  });
  const handledTokenRef = useRef<string | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const ready = !!request;

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params['id_token'];
    if (!idToken || handledTokenRef.current === idToken) return;
    handledTokenRef.current = idToken;
    setSigningIn(true);
    setError(null);
    signInWithGoogleIdToken(idToken)
      .catch((err: unknown) => {
        handledTokenRef.current = null;
        setError(err);
      })
      .finally(() => {
        setSigningIn(false);
      });
  }, [response]);

  const prompt = async (): Promise<void> => {
    setError(null);
    await promptAsync();
  };

  return {
    ready,
    error,
    signingIn,
    prompt,
    resetError: () => setError(null),
  };
}
