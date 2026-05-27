'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type SplitType = 'EQUAL' | 'CUSTOM';

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
  splitType: SplitType;
  paidBy: ExpenseMemberRef;
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
}

interface SplitInput {
  memberId: string;
  amount: number;
}

export interface CreateExpensePayload {
  description: string;
  amount: number;
  /** EventMember.id of the payer */
  paidById: string;
  category?: string;
  receiptUrl?: string;
  splitType: SplitType;
  /** For EQUAL splits: which member IDs to include (omit = all active members) */
  memberIds?: string[];
  /** For CUSTOM splits: per-member amounts that must sum to `amount` */
  splits?: SplitInput[];
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

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

interface OptimisticMember {
  id: string;
  nickname: string;
  userId: string | null;
}

export function useCreateExpense(eventId: string, members?: OptimisticMember[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      api.post<Expense>(`/events/${eventId}/expenses`, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: expenseKeys.list(eventId) });
      const previous = qc.getQueryData<Expense[]>(expenseKeys.list(eventId));

      const payer = members?.find((m) => m.id === payload.paidById);

      const tempExpense: Expense = {
        id: `temp-${Date.now()}`,
        eventId,
        description: payload.description,
        amount: payload.amount,
        category: payload.category ?? null,
        receiptUrl: payload.receiptUrl ?? null,
        splitType: payload.splitType,
        paidBy: {
          id: payload.paidById,
          nickname: payer?.nickname ?? '…',
          userId: payer?.userId ?? null,
        },
        splits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      qc.setQueryData<Expense[]>(expenseKeys.list(eventId), (old) => [
        tempExpense,
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(expenseKeys.list(eventId), context.previous);
      }
    },
    onSettled: () => {
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
    onMutate: async ({ expenseId, payload }) => {
      await qc.cancelQueries({ queryKey: expenseKeys.list(eventId) });
      const previous = qc.getQueryData<Expense[]>(expenseKeys.list(eventId));
      qc.setQueryData<Expense[]>(expenseKeys.list(eventId), (old) =>
        (old ?? []).map((e) =>
          e.id === expenseId
            ? {
                ...e,
                ...(payload.description !== undefined && { description: payload.description }),
                ...(payload.amount !== undefined && { amount: payload.amount }),
                ...(payload.category !== undefined && { category: payload.category }),
                ...(payload.paidById !== undefined && {
                  paidBy: { ...e.paidBy, id: payload.paidById },
                }),
              }
            : e,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(expenseKeys.list(eventId), context.previous);
      }
    },
    onSettled: () => {
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
    onMutate: async (expenseId) => {
      await qc.cancelQueries({ queryKey: expenseKeys.list(eventId) });
      const previous = qc.getQueryData<Expense[]>(expenseKeys.list(eventId));
      qc.setQueryData<Expense[]>(expenseKeys.list(eventId), (old) =>
        (old ?? []).filter((e) => e.id !== expenseId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(expenseKeys.list(eventId), context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.list(eventId) });
      void qc.invalidateQueries({ queryKey: ['events', eventId, 'balances'] });
    },
  });
}
