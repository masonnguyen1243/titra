'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export interface MemberBalance {
  memberId: string;
  nickname: string;
  userId: string | null;
  net: number;
}

export interface SettlementSuggestion {
  fromMemberId: string;
  fromNickname: string;
  toMemberId: string;
  toNickname: string;
  amount: number;
}

export interface BalanceResult {
  members: MemberBalance[];
  settlements: SettlementSuggestion[];
}

export const balanceKeys = {
  detail: (eventId: string) => ['events', eventId, 'balances'] as const,
};

export function useBalances(eventId: string) {
  return useQuery({
    queryKey: balanceKeys.detail(eventId),
    queryFn: () => api.get<BalanceResult>(`/events/${eventId}/balances`),
    enabled: !!eventId,
  });
}
