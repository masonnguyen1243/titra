'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { EventStatus, EventType } from './use-events';
import type { UserProfile } from './use-user';

export interface AdminStats {
  totalUsers: number;
  totalEvents: number;
  activeEvents: number;
  archivedEvents: number;
  totalVnd: number;
}

export interface AdminUser extends UserProfile {
  isActive: boolean;
}

export interface AdminEventItem {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: string;
  organizer: { id: string; name: string; email: string };
  _count: { members: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

interface PaginateParams {
  page?: number;
  limit?: number;
}

interface UpdateUserStatusPayload {
  isActive: boolean;
}

export const adminKeys = {
  stats: () => ['admin', 'stats'] as const,
  users: (params: PaginateParams) => ['admin', 'users', params] as const,
  events: (params: PaginateParams) => ['admin', 'events', params] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => api.get<AdminStats>('/admin/stats'),
  });
}

export function useAdminUsers(params: PaginateParams = {}) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return api.get<Paginated<AdminUser>>(`/admin/users${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserStatusPayload }) =>
      api.patch<AdminUser>(`/admin/users/${id}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdminEvents(params: PaginateParams = {}) {
  return useQuery({
    queryKey: adminKeys.events(params),
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return api.get<Paginated<AdminEventItem>>(`/admin/events${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useArchiveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.patch<AdminEventItem>(`/admin/events/${eventId}/archive`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      void qc.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}
