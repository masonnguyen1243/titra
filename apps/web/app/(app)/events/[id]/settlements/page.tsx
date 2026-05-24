'use client';

import { use } from 'react';
import { Badge } from '@/components/ui/badge';
import { Handshake, Clock, CheckCircle2 } from 'lucide-react';

type SettlementStatus = 'PENDING' | 'CONFIRMED';
type PaymentMethod = 'MOMO' | 'VNPAY' | 'CASH' | 'OTHER';

interface Settlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  method: PaymentMethod;
  status: SettlementStatus;
  date: string;
  hasProof: boolean;
}

const SEED_SETTLEMENTS: Record<string, Settlement[]> = {
  '1': [
    {
      id: 's1',
      from: 'Hùng',
      to: 'Minh Anh',
      amount: 580000,
      method: 'MOMO',
      status: 'CONFIRMED',
      date: '2025-03-18',
      hasProof: true,
    },
    {
      id: 's2',
      from: 'Tuấn',
      to: 'Minh Anh',
      amount: 420000,
      method: 'VNPAY',
      status: 'PENDING',
      date: '2025-03-18',
      hasProof: true,
    },
    {
      id: 's3',
      from: 'An',
      to: 'Linh',
      amount: 100000,
      method: 'CASH',
      status: 'PENDING',
      date: '2025-03-19',
      hasProof: false,
    },
  ],
  '2': [
    {
      id: 's4',
      from: 'Nam',
      to: 'Lan',
      amount: 300000,
      method: 'MOMO',
      status: 'CONFIRMED',
      date: '2025-01-21',
      hasProof: true,
    },
    {
      id: 's5',
      from: 'Phương',
      to: 'Dũng',
      amount: 100000,
      method: 'CASH',
      status: 'CONFIRMED',
      date: '2025-01-22',
      hasProof: false,
    },
  ],
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CASH: 'Tiền mặt',
  OTHER: 'Khác',
};

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function StatusBadge({ status }: { status: SettlementStatus }) {
  if (status === 'CONFIRMED') {
    return (
      <Badge variant="success" className="gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Đã xác nhận
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1 text-xs">
      <Clock className="h-3 w-3" />
      Chờ xác nhận
    </Badge>
  );
}

export default function SettlementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const settlements = SEED_SETTLEMENTS[id] ?? [];

  if (settlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Handshake className="h-10 w-10 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="font-medium text-sm">Chưa có giao dịch nào</p>
          <p className="text-muted-foreground text-sm">
            Các khoản thanh toán giữa thành viên sẽ hiển thị ở đây.
          </p>
        </div>
      </div>
    );
  }

  const confirmed = settlements.filter((s) => s.status === 'CONFIRMED').length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {settlements.length} giao dịch · {confirmed} đã xác nhận
      </p>

      <div className="divide-y rounded-lg border">
        {settlements.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {s.from} → {s.to}
                </span>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {METHOD_LABELS[s.method]}
                {s.hasProof && ' · Có ảnh chứng minh'}
                {' · '}
                {new Date(s.date).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <span className="font-semibold text-sm shrink-0 tabular-nums">
              {formatVND(s.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
