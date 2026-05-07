import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserDoc } from '@salon/shared';
import { auth, firestore } from '../config/firebase';
import { registerForPushNotifications } from '../notifications/setup';

interface AuthState {
  authUser: User | null;
  profile: UserDoc | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [state, setState] = useState<AuthState>({
    authUser: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, authUser: user, loading: !!user }));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!state.authUser) {
      setState((prev) => ({ ...prev, profile: null, loading: false }));
      return;
    }
    const uid = state.authUser.uid;
    const ref = doc(firestore, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as UserDoc) : null;
        setState((prev) => ({ ...prev, profile: data, loading: false }));
      },
      () => {
        setState((prev) => ({ ...prev, profile: null, loading: false }));
      },
    );
    void registerForPushNotifications(uid).catch(() => undefined);
    return () => unsub();
  }, [state.authUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signOut: async () => {
        await fbSignOut(auth);
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
