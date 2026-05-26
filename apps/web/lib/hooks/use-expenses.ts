'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type SplitMode = 'EQUAL' | 'CUSTOM';

export interface ExpenseMemberRef {
  id: string;
  nickname: string;
  userId: string | null;
}

export interface ExpenseSplit {
  id: string;
  memberId: string;
  amount: number;
  member: { nickname: string; userId: string | null };
}

export interface Expense {
  id: string;
  eventId: string;
  description: string;
  amount: number;
  category: string | null;
  receiptUrl: string | null;
  splitMode: SplitMode;
  paidBy: ExpenseMemberRef;
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
}

interface SplitInput {
  memberId: string;
  amount: number;
}

interface CreateExpensePayload {
  description: string;
  amount: number;
  paidByMemberId: string;
  category?: string;
  receiptUrl?: string;
  splitMode: SplitMode;
  splits?: SplitInput[];
}

type UpdateExpensePayload = Partial<CreateExpensePayload>;

export const expenseKeys = {
  list: (eventId: string) => ['events', eventId, 'expenses'] as const,
};

export function useExpenses(eventId: string) {
  return useQuery({
    queryKey: expenseKeys.list(eventId),
    queryFn: () => api.get<Expense[]>(`/events/${eventId}/expenses`),
    enabled: !!eventId,
  });
}

export function useCreateExpense(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      api.post<Expense>(`/events/${eventId}/expenses`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.list(eventId) });
      void qc.invalidateQueries({ queryKey: ['events', eventId, 'balances'] });
    },
  });
}

export function useUpdateExpense(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, payload }: { expenseId: string; payload: UpdateExpensePayload }) =>
      api.patch<Expense>(`/events/${eventId}/expenses/${expenseId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.list(eventId) });
      void qc.invalidateQueries({ queryKey: ['events', eventId, 'balances'] });
    },
  });
}

export function useDeleteExpense(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) =>
      api.delete<void>(`/events/${eventId}/expenses/${expenseId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.list(eventId) });
      void qc.invalidateQueries({ queryKey: ['events', eventId, 'balances'] });
    },
  });
}
