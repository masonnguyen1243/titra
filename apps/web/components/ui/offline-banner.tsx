'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { onlineManager } from '@tanstack/react-query';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Initialise from TanStack Query's own online state so the banner is in
    // sync with query pausing/resuming. onlineManager.subscribe returns the
    // unsubscribe function, which useEffect uses for cleanup.
    setIsOffline(!onlineManager.isOnline());
    return onlineManager.subscribe((online) => setIsOffline(!online));
  }, []);

  if (!isOffline) return null;

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Mất kết nối internet.</span>
    </div>
  );
}
