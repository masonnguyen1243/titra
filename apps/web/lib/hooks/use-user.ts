'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  createdAt: string;
}

interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
}

export const userKeys = {
  me: () => ['users', 'me'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => api.get<UserProfile>('/users/me'),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      api.patch<UserProfile>('/users/me', payload),
    onSuccess: (updated) => {
      qc.setQueryData(userKeys.me(), updated);
    },
  });
}
