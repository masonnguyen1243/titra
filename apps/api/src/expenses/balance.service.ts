import { Injectable } from '@nestjs/common';

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

@Injectable()
export class BalanceService {
  compute(members: MemberBalance[]): BalanceResult {
    const settlements = simplifyDebts(members);
    return { members, settlements };
  }
}

/**
 * Minimum cash-flow algorithm: O(n log n).
 * Greedily matches the largest debtor with the largest creditor until all
 * balances reach zero, yielding the minimum number of transactions.
 */
export function simplifyDebts(members: MemberBalance[]): SettlementSuggestion[] {
  const creditors = members
    .filter((m) => m.net > 0)
    .map((m) => ({ ...m, remaining: m.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = members
    .filter((m) => m.net < 0)
    .map((m) => ({ ...m, remaining: -m.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const result: SettlementSuggestion[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.remaining, debtor.remaining);

    result.push({
      fromMemberId: debtor.memberId,
      fromNickname: debtor.nickname,
      toMemberId: creditor.memberId,
      toNickname: creditor.nickname,
      amount,
    });

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    if (creditor.remaining === 0) ci++;
    if (debtor.remaining === 0) di++;
  }

  return result;
}
