'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Receipt } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import AddExpenseDialog, {
  type Member,
  type NewExpense,
} from '@/components/features/add-expense-dialog';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  payer: string;
  date: string;
}

const SEED_EXPENSES: Record<string, Expense[]> = {
  '1': [
    {
      id: 'e1',
      description: 'Khách sạn Ana Mandara',
      amount: 2400000,
      category: 'ACCOMMODATION',
      payer: 'Minh Anh',
      date: '2025-03-15',
    },
    {
      id: 'e2',
      description: 'Bữa tối Nhà hàng Thiên Phú',
      amount: 850000,
      category: 'FOOD',
      payer: 'Hùng',
      date: '2025-03-15',
    },
    {
      id: 'e3',
      description: 'Thuê xe máy 2 ngày',
      amount: 600000,
      category: 'TRANSPORT',
      payer: 'Linh',
      date: '2025-03-16',
    },
    {
      id: 'e4',
      description: 'Vé cáp treo LangBiang',
      amount: 450000,
      category: 'ACTIVITY',
      payer: 'Minh Anh',
      date: '2025-03-16',
    },
    {
      id: 'e5',
      description: 'Cà phê buổi sáng',
      amount: 210000,
      category: 'FOOD',
      payer: 'Tuấn',
      date: '2025-03-17',
    },
  ],
  '2': [
    {
      id: 'e6',
      description: 'Bữa tất niên Nhà hàng Hoa Sen',
      amount: 3600000,
      category: 'FOOD',
      payer: 'Lan',
      date: '2025-01-20',
    },
    {
      id: 'e7',
      description: 'Karaoke sau tiệc',
      amount: 1200000,
      category: 'ACTIVITY',
      payer: 'Dũng',
      date: '2025-01-20',
    },
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

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: 'Ăn uống',
  TRANSPORT: 'Di chuyển',
  ACCOMMODATION: 'Lưu trú',
  ACTIVITY: 'Vui chơi',
  OTHER: 'Khác',
};

const CATEGORY_VARIANTS: Record<
  ExpenseCategory,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  FOOD: 'default',
  TRANSPORT: 'secondary',
  ACCOMMODATION: 'outline',
  ACTIVITY: 'secondary',
  OTHER: 'outline',
};

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

let nextId = 100;

export default function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [expenses, setExpenses] = useState<Expense[]>(SEED_EXPENSES[id] ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const members = MOCK_MEMBERS[id] ?? DEFAULT_MEMBERS;

  function handleAdd(expense: NewExpense) {
    setExpenses((prev) => [
      ...prev,
      {
        id: `new-${++nextId}`,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        payer: expense.payer,
        date: expense.date,
      },
    ]);
  }

  return (
    <>
      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có chi phí nào"
          description="Hãy thêm chi phí đầu tiên cho sự kiện này."
        >
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm chi phí
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {expenses.length} khoản · Tổng{' '}
              <span className="font-semibold text-foreground">
                {formatVND(expenses.reduce((sum, e) => sum + e.amount, 0))}
              </span>
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm chi phí
            </Button>
          </div>

          <div className="divide-y rounded-lg border">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{expense.description}</span>
                    <Badge
                      variant={CATEGORY_VARIANTS[expense.category]}
                      className="text-xs shrink-0"
                    >
                      {CATEGORY_LABELS[expense.category]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {expense.payer} · {new Date(expense.date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <span className="font-semibold text-sm shrink-0 tabular-nums">
                  {formatVND(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        onAdd={handleAdd}
      />
    </>
  );
}
