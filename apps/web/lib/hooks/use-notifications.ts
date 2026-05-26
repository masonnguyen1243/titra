'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

interface SendReminderPayload {
  memberId: string;
}

interface ReminderResult {
  ok: boolean;
  sentTo: string;
  lastReminderAt: string;
}

export function useSendReminder(eventId: string) {
  return useMutation({
    mutationFn: (payload: SendReminderPayload) =>
      api.post<ReminderResult>(`/events/${eventId}/reminders`, payload),
  });
}
