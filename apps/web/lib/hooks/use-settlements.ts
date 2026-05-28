'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { balanceKeys } from './use-balances';

export type SettlementStatus = 'PENDING' | 'CONFIRMED';
export type PaymentMethod = 'CASH' | 'OTHER' | 'MOMO' | 'VNPAY';

export interface SettlementMemberRef {
  id: string;
  nickname: string;
  userId: string | null;
}

export interface Settlement {
  id: string;
  eventId: string;
  amount: number;
  method: PaymentMethod;
  status: SettlementStatus;
  proofUrl: string | null;
  fromMember: SettlementMemberRef;
  toMember: SettlementMemberRef;
  createdAt: string;
  updatedAt: string;
}

interface CreateSettlementPayload {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  method?: PaymentMethod;
  proofUrl?: string;
  // optimistic display only — stripped before API call
  _fromMember?: SettlementMemberRef;
  _toMember?: SettlementMemberRef;
}

export const settlementKeys = {
  list: (eventId: string) => ['events', eventId, 'settlements'] as const,
};

export function useSettlements(eventId: string) {
  return useQuery({
    queryKey: settlementKeys.list(eventId),
    queryFn: () => api.get<Settlement[]>(`/events/${eventId}/settlements`),
    enabled: !!eventId,
  });
}

export function useCreateSettlement(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ _fromMember: _f, _toMember: _t, ...payload }: CreateSettlementPayload) =>
      api.post<Settlement>(`/events/${eventId}/settlements`, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: settlementKeys.list(eventId) });
      const prev = qc.getQueryData<Settlement[]>(settlementKeys.list(eventId));

      if (payload._fromMember && payload._toMember) {
        const optimistic: Settlement = {
          id: `optimistic-${Date.now()}`,
          eventId,
          amount: payload.amount,
          method: payload.method ?? 'CASH',
          status: 'PENDING',
          proofUrl: payload.proofUrl ?? null,
          fromMember: payload._fromMember,
          toMember: payload._toMember,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        qc.setQueryData<Settlement[]>(settlementKeys.list(eventId), (old) => [
          ...(old ?? []),
          optimistic,
        ]);
      }

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        qc.setQueryData<Settlement[]>(settlementKeys.list(eventId), context.prev);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.list(eventId) });
    },
  });
}

export function useConfirmSettlement(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      api.patch<Settlement>(`/events/${eventId}/settlements/${settlementId}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.list(eventId) });
      void qc.invalidateQueries({ queryKey: balanceKeys.detail(eventId) });
    },
  });
}

export function useDeleteSettlement(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      api.delete<void>(`/events/${eventId}/settlements/${settlementId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.list(eventId) });
    },
  });
}
