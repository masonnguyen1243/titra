'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface MessageSender {
  id: string;
  nickname: string;
  userId: string | null;
}

export interface Message {
  id: string;
  eventId: string;
  content: string;
  sender: MessageSender;
  createdAt: string;
}

export interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

export const messageKeys = {
  list: (eventId: string) => ['events', eventId, 'messages'] as const,
};

export function useMessages(eventId: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(eventId),
    queryFn: ({ pageParam }) => {
      const params = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return api.get<MessagesPage>(`/events/${eventId}/messages${params}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!eventId,
  });
}

export function useSendMessage(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.post<Message>(`/events/${eventId}/messages`, { content }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.list(eventId) });
    },
  });
}
