import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService, MemberBalance, simplifyDebts } from './balance.service';

function member(id: string, net: number, nickname = `User-${id}`): MemberBalance {
  return { memberId: id, nickname, userId: `user-${id}`, net };
}

describe('simplifyDebts', () => {
  it('returns empty array when no members', () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it('returns empty array when all nets are zero', () => {
    expect(simplifyDebts([member('a', 0), member('b', 0)])).toEqual([]);
  });

  it('returns empty array when only creditors (no debtors)', () => {
    expect(simplifyDebts([member('a', 100_000)])).toEqual([]);
  });

  it('returns empty array when only debtors (no creditors)', () => {
    expect(simplifyDebts([member('a', -100_000)])).toEqual([]);
  });

  it('one debtor pays one creditor exactly', () => {
    const result = simplifyDebts([member('a', 60_000), member('b', -60_000)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fromMemberId: 'b',
      toMemberId: 'a',
      amount: 60_000,
    });
  });

  it('debtor amount less than creditor — single partial settlement', () => {
    // a is owed 100k, b only owes 40k (another creditor must cover the rest)
    const result = simplifyDebts([
      member('a', 100_000),
      member('b', -40_000),
      member('c', -60_000),
    ]);
    expect(result).toHaveLength(2);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(100_000);
    expect(result.every((r) => r.toMemberId === 'a')).toBe(true);
  });

  it('classic three-way equal split: Alice pays 90k for 3 people', () => {
    // Alice net = 90k - 30k = +60k, Bob = -30k, Carol = -30k
    const result = simplifyDebts([
      member('alice', 60_000, 'Alice'),
      member('bob', -30_000, 'Bob'),
      member('carol', -30_000, 'Carol'),
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.toMemberId === 'alice')).toBe(true);
    const amounts = result.map((r) => r.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([30_000, 30_000]);
  });

  it('minimises transactions: 3 debtors, 2 creditors', () => {
    // Total debts = total credits = 150k
    const result = simplifyDebts([
      member('c1', 100_000),
      member('c2', 50_000),
      member('d1', -80_000),
      member('d2', -40_000),
      member('d3', -30_000),
    ]);
    // All debts must be settled
    const totalPaid = result.reduce((s, r) => s + r.amount, 0);
    expect(totalPaid).toBe(150_000);
    // All from-members are debtors
    const debtorIds = new Set(['d1', 'd2', 'd3']);
    expect(result.every((r) => debtorIds.has(r.fromMemberId))).toBe(true);
    // All to-members are creditors
    const creditorIds = new Set(['c1', 'c2']);
    expect(result.every((r) => creditorIds.has(r.toMemberId))).toBe(true);
  });

  it('members with net = 0 do not appear in any settlement', () => {
    const result = simplifyDebts([
      member('a', 50_000),
      member('b', -50_000),
      member('c', 0),
    ]);
    expect(result).toHaveLength(1);
    expect(result.every((r) => r.fromMemberId !== 'c' && r.toMemberId !== 'c')).toBe(true);
  });

  it('large VND amounts (no rounding errors with integers)', () => {
    const result = simplifyDebts([
      member('a', 5_000_000),
      member('b', -3_000_000),
      member('c', -2_000_000),
    ]);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(5_000_000);
  });

  it('settlement nicknames match input members', () => {
    const result = simplifyDebts([
      member('alice', 40_000, 'Alice Nguyen'),
      member('bob', -40_000, 'Bob Tran'),
    ]);
    expect(result[0]).toMatchObject({
      fromNickname: 'Bob Tran',
      toNickname: 'Alice Nguyen',
    });
  });
});

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BalanceService],
    }).compile();

    service = module.get(BalanceService);
  });

  it('returns members unchanged in result', () => {
    const members = [member('a', 30_000), member('b', -30_000)];
    const result = service.compute(members);
    expect(result.members).toBe(members);
  });

  it('compute delegates to simplifyDebts', () => {
    const members = [member('a', 30_000), member('b', -30_000)];
    const result = service.compute(members);
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0]).toMatchObject({
      fromMemberId: 'b',
      toMemberId: 'a',
      amount: 30_000,
    });
  });

  it('returns empty settlements when everyone is settled', () => {
    const result = service.compute([member('a', 0), member('b', 0)]);
    expect(result.settlements).toEqual([]);
  });
});
