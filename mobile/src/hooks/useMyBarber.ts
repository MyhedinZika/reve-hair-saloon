import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { BarberDoc } from '@salon/shared';
import { firestore } from '../config/firebase';

export function useMyBarber(uid: string | null): BarberDoc | null {
  const [barber, setBarber] = useState<BarberDoc | null>(null);

  useEffect(() => {
    if (!uid) {
      setBarber(null);
      return;
    }
    const q = query(collection(firestore, 'barbers'), where('userId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const first = snap.docs[0];
      setBarber(first ? (first.data() as BarberDoc) : null);
    });
    return () => unsub();
  }, [uid]);

  return barber;
}
