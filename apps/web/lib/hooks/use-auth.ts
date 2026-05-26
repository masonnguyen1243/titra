'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.post<void>('/auth/login', payload),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.post<void>('/auth/register', payload),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<void>('/auth/forgot-password', { email }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => api.post<void>('/auth/verify-email', { token }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.post<void>('/auth/reset-password', { token, password }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => api.post<void>('/auth/resend-verification', { email }),
  });
}
