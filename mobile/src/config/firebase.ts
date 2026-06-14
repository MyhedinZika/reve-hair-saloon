import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  connectAuthEmulator,
  getReactNativePersistence,
  type Auth,
} from '@firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emulatorHost, firebaseConfig, firebaseFunctionsRegion, useEmulator } from './env';

const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const firestore: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const functions: Functions = getFunctions(app, firebaseFunctionsRegion);

if (useEmulator) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`);
  connectFirestoreEmulator(firestore, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}

export { app, auth, firestore, functions };
