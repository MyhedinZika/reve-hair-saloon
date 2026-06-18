export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: 'AIzaSyAlovHia0AHrJYknIV-oqwU-dDrdTA1BS4',
  authDomain: 'revehairsaloon2026.firebaseapp.com',
  projectId: 'revehairsaloon2026',
  storageBucket: 'revehairsaloon2026.firebasestorage.app',
  messagingSenderId: '1099495106269',
  appId: '1:1099495106269:web:5a9476dcac5198aa12dd34',
  measurementId: 'G-DCCQMJYGLK',
};

declare const __DEV__: boolean | undefined;
declare const process:
  | {
      env?: {
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
        EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
        EXPO_PUBLIC_USE_FIREBASE_EMULATOR?: string;
        EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?: string;
      };
    }
  | undefined;

const env = typeof process === 'undefined' ? undefined : process.env;

export const googleWebClientId =
  env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '1099495106269-5qscn0d953u8cbqesbv6d003omh23rkm.apps.googleusercontent.com';
export const googleIosClientId =
  env?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '1099495106269-bu9m7j471hnk47cteq2bsrrt61f444bq.apps.googleusercontent.com';
export const googleAndroidClientId =
  env?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
  '1099495106269-tni008t35k7ltrgb8ragfvs49p604beu.apps.googleusercontent.com';
export const firebaseFunctionsRegion = 'europe-west1';
export const expoProjectId = 'fefab8e3-a707-41b9-83a4-209c407e2acd';

const useEmulatorOverride = env?.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;

export const useEmulator =
  useEmulatorOverride === undefined
    ? typeof __DEV__ === 'boolean' ? __DEV__ : false
    : useEmulatorOverride === 'true';
export const emulatorHost = env?.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? '100.121.1.121';
