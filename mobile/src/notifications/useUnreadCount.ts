import { useEffect, useState } from 'react';
import { stores } from '../api/firestore';

export function useUnreadCount(uid: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    const unsub = stores.watchNotifications(uid, (docs) => {
      setCount(docs.filter((d) => !d.read).length);
    });
    return () => unsub();
  }, [uid]);

  return count;
}
