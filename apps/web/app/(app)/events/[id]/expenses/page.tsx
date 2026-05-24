'use client';

import { use } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Receipt } from 'lucide-react';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  payer: string;
  date: string;
}

const MOCK_EXPENSES: Record<string, Expense[]> = {
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

export default function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const expenses = MOCK_EXPENSES[id] ?? [];

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Receipt className="h-10 w-10 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="font-medium text-sm">Chưa có chi phí nào</p>
          <p className="text-muted-foreground text-sm">Hãy thêm chi phí đầu tiên cho sự kiện này.</p>
        </div>
        <Button size="sm" className="mt-1">
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm chi phí
        </Button>
      </div>
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {expenses.length} khoản · Tổng{' '}
          <span className="font-semibold text-foreground">{formatVND(total)}</span>
        </p>
        <Button size="sm">
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
                <Badge variant={CATEGORY_VARIANTS[expense.category]} className="text-xs shrink-0">
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
  );
}
