'use client';

import { use, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Handshake, Clock, CheckCircle2, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import RecordSettlementDialog, {
  type Member,
  type NewSettlement,
} from '@/components/features/record-settlement-dialog';

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
  ],
};

const DEFAULT_MEMBERS: Member[] = [{ id: 'u1', name: 'Bạn' }];

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

let nextId = 100;

export default function SettlementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [settlements, setSettlements] = useState<Settlement[]>(SEED_SETTLEMENTS[id] ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const members = MOCK_MEMBERS[id] ?? DEFAULT_MEMBERS;

  function handleAdd(s: NewSettlement) {
    setSettlements((prev) => [
      ...prev,
      {
        id: `new-${++nextId}`,
        from: s.from,
        to: s.to,
        amount: s.amount,
        method: s.method,
        status: 'PENDING',
        date: s.date,
        hasProof: s.hasProof,
      },
    ]);
  }

  const confirmed = settlements.filter((s) => s.status === 'CONFIRMED').length;

  return (
    <>
      {settlements.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Chưa có giao dịch nào"
          description="Các khoản thanh toán giữa thành viên sẽ hiển thị ở đây."
        >
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ghi nhận thanh toán
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {settlements.length} giao dịch · {confirmed} đã xác nhận
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ghi nhận thanh toán
            </Button>
          </div>

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
      )}

      <RecordSettlementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        onAdd={handleAdd}
      />
    </>
  );
}
