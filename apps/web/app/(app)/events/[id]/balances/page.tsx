'use client';

import { use } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  payer: string;
  date: string;
}

interface Member {
  id: string;
  name: string;
}

const SEED_EXPENSES: Record<string, Expense[]> = {
  '1': [
    { id: 'e1', description: 'Khách sạn Ana Mandara', amount: 2400000, category: 'ACCOMMODATION', payer: 'Minh Anh', date: '2025-03-15' },
    { id: 'e2', description: 'Bữa tối Nhà hàng Thiên Phú', amount: 850000, category: 'FOOD', payer: 'Hùng', date: '2025-03-15' },
    { id: 'e3', description: 'Thuê xe máy 2 ngày', amount: 600000, category: 'TRANSPORT', payer: 'Linh', date: '2025-03-16' },
    { id: 'e4', description: 'Vé cáp treo LangBiang', amount: 450000, category: 'ACTIVITY', payer: 'Minh Anh', date: '2025-03-16' },
    { id: 'e5', description: 'Cà phê buổi sáng', amount: 210000, category: 'FOOD', payer: 'Tuấn', date: '2025-03-17' },
  ],
  '2': [
    { id: 'e6', description: 'Bữa tất niên Nhà hàng Hoa Sen', amount: 3600000, category: 'FOOD', payer: 'Lan', date: '2025-01-20' },
    { id: 'e7', description: 'Karaoke sau tiệc', amount: 1200000, category: 'ACTIVITY', payer: 'Dũng', date: '2025-01-20' },
  ],
};

const MOCK_MEMBERS: Record<string, Member[]> = {
  '1': [
    { id: 'm1', name: 'Minh Anh' },
    { id: 'm2', name: 'Hùng' },
    { id: 'm3', name: 'Linh' },
    { id: 'm4', name: 'Tuấn' },
    { id: 'm5', name: 'An' },
    { id: 'm6', name: 'Ngọc' },
  ],
  '2': [
    { id: 'm1', name: 'Lan' },
    { id: 'm2', name: 'Dũng' },
    { id: 'm3', name: 'Nam' },
    { id: 'm4', name: 'Phương' },
    { id: 'm5', name: 'Hà' },
    { id: 'm6', name: 'Khoa' },
    { id: 'm7', name: 'Thắng' },
    { id: 'm8', name: 'Bình' },
    { id: 'm9', name: 'Quân' },
    { id: 'm10', name: 'Mai' },
    { id: 'm11', name: 'Tùng' },
    { id: 'm12', name: 'Phúc' },
  ],
};

const DEFAULT_MEMBERS: Member[] = [{ id: 'u1', name: 'Bạn' }];

function computeNetBalances(expenses: Expense[], members: Member[]): Record<string, number> {
  const n = members.length;
  const balances: Record<string, number> = {};
  for (const m of members) balances[m.name] = 0;

  for (const expense of expenses) {
    if (expense.payer in balances) {
      balances[expense.payer] += expense.amount;
    }
    const perPerson = Math.floor(expense.amount / n);
    const remainder = expense.amount - perPerson * n;
    for (let i = 0; i < members.length; i++) {
      balances[members[i].name] -= i === 0 ? perPerson + remainder : perPerson;
    }
  }

  return balances;
}

interface Transaction {
  from: string;
  to: string;
  amount: number;
}

function simplifyDebts(balances: Record<string, number>): Transaction[] {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];

  for (const [name, balance] of Object.entries(balances)) {
    if (balance > 0) creditors.push([name, balance]);
    else if (balance < 0) debtors.push([name, -balance]);
  }

  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => b[1] - a[1]);

  const transactions: Transaction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const [creditor, credit] = creditors[ci];
    const [debtor, debt] = debtors[di];
    const amount = Math.min(credit, debt);

    transactions.push({ from: debtor, to: creditor, amount });

    creditors[ci] = [creditor, credit - amount];
    debtors[di] = [debtor, debt - amount];

    if (creditors[ci][1] === 0) ci++;
    if (debtors[di][1] === 0) di++;
  }

  return transactions;
}

function formatVND(amount: number): string {
  const rounded = Math.round(amount / 1000) * 1000;
  return rounded.toLocaleString('vi-VN') + ' ₫';
}

export default function BalancesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const expenses = SEED_EXPENSES[id] ?? [];
  const members = MOCK_MEMBERS[id] ?? DEFAULT_MEMBERS;

  const netBalances = computeNetBalances(expenses, members);
  const transactions = simplifyDebts(netBalances);
  const allSettled = transactions.length === 0;

  if (allSettled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <PartyPopper className="h-10 w-10 text-emerald-500" />
        <p className="font-medium">Mọi người đã huề cả làng 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Số dư từng người
        </h2>
        <div className="divide-y rounded-lg border">
          {members.map((member) => {
            const balance = netBalances[member.name] ?? 0;
            const isPositive = balance > 0;
            const isNegative = balance < 0;

            return (
              <div key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.name} size="md" />
                  <span className="text-sm font-medium">{member.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPositive && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                  {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  {!isPositive && !isNegative && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      isPositive && 'text-emerald-600',
                      isNegative && 'text-red-500',
                      !isPositive && !isNegative && 'text-muted-foreground',
                    )}
                  >
                    {isPositive ? '+' : ''}
                    {formatVND(balance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Ai cần trả ai
        </h2>
        <div className="divide-y rounded-lg border">
          {transactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="font-medium truncate">{t.from}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{t.to}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0">{formatVND(t.amount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
