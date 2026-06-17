import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { googleAndroidClientId, googleIosClientId, googleWebClientId } from '../config/env';
import { signInWithGoogleIdToken } from './api';

WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInState {
  ready: boolean;
  prompt: () => Promise<void>;
}

export function useGoogleSignIn(): GoogleSignInState {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId,
    ...(googleIosClientId ? { iosClientId: googleIosClientId } : {}),
    ...(googleAndroidClientId ? { androidClientId: googleAndroidClientId } : {}),
    clientId: googleWebClientId,
  });

  const ready = !!request;

  const prompt = async (): Promise<void> => {
    const result = await promptAsync();
    if (result.type !== 'success') return;
    const idToken = result.params['id_token'];
    if (!idToken) return;
    await signInWithGoogleIdToken(idToken);
  };

  void response;
  return { ready, prompt };
}
