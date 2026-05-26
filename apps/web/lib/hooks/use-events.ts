'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type EventStatus = 'ACTIVE' | 'SETTLED' | 'ARCHIVED';
export type EventType = 'TRIP' | 'MEAL' | 'OTHER';
export type MemberRole = 'ORGANIZER' | 'MEMBER';

export interface EventListItem {
  id: string;
  name: string;
  description: string | null;
  type: EventType;
  status: EventStatus;
  coverImageUrl: string | null;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
}

export interface EventMember {
  id: string;
  userId: string | null;
  nickname: string;
  role: MemberRole;
  joinedAt: string;
}

export interface EventDetail extends Omit<EventListItem, '_count'> {
  members: EventMember[];
}

interface CreateEventPayload {
  name: string;
  type: EventType;
  description?: string;
  coverImageUrl?: string;
}

interface UpdateEventPayload {
  name?: string;
  description?: string;
  coverImageUrl?: string;
}

type AddMemberPayload = { email: string } | { nickname: string };

export const eventKeys = {
  all: () => ['events'] as const,
  detail: (id: string) => ['events', id] as const,
  invite: (id: string) => ['events', id, 'invite'] as const,
};

export function useEvents() {
  return useQuery({
    queryKey: eventKeys.all(),
    queryFn: () => api.get<EventListItem[]>('/events'),
  });
}

export function useEventDetail(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => api.get<EventDetail>(`/events/${id}`),
    enabled: !!id,
  });
}

export function useInviteLink(eventId: string) {
  return useQuery({
    queryKey: eventKeys.invite(eventId),
    queryFn: () => api.get<{ inviteLink: string }>(`/events/${eventId}/invite`),
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEventPayload) =>
      api.post<EventListItem>('/events', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.all() });
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEventPayload) =>
      api.patch<EventDetail>(`/events/${eventId}`, payload),
    onSuccess: (updated) => {
      qc.setQueryData(eventKeys.detail(eventId), updated);
      void qc.invalidateQueries({ queryKey: eventKeys.all() });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.delete<void>(`/events/${eventId}`),
    onSuccess: (_data, eventId) => {
      qc.removeQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.all() });
    },
  });
}

export function useRegenerateInvite(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch<{ inviteLink: string }>(`/events/${eventId}/invite`),
    onSuccess: (updated) => {
      qc.setQueryData(eventKeys.invite(eventId), updated);
    },
  });
}

export function useJoinEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, token }: { eventId: string; token: string }) =>
      api.post<EventMember>(`/events/${eventId}/join`, { token }),
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.all() });
    },
  });
}

export function useAddMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddMemberPayload) =>
      api.post<{ ok: boolean }>(`/events/${eventId}/members`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

export function useRemoveMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete<void>(`/events/${eventId}/members/${memberId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, token }: { eventId: string; token: string }) =>
      api.post<EventMember>(`/events/${eventId}/invitations/${token}/accept`),
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.all() });
    },
  });
}
