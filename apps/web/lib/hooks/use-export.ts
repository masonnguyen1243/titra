'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

export function useExportPdf(eventId: string) {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>(`/events/${eventId}/export/pdf`),
  });
}
