'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

function handleQueryError(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (error.status === 401) return; // handled in api.ts (redirect to /login)
  if (error.status === 404) return; // pages show inline "not found" state
  if (error.status === 403) {
    toast.error('Bạn không có quyền thực hiện thao tác này', { id: 'forbidden' });
    return;
  }
  if (error.status >= 500) {
    toast.error('Lỗi máy chủ. Vui lòng thử lại sau.', { id: 'server-error' });
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // Only global-handle query errors; mutations handle their own errors inline
        queryCache: new QueryCache({ onError: handleQueryError }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
