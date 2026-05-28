'use client';

import { use, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Check, Handshake, Loader2, Plus, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SettlementListSkeleton } from '@/components/ui/skeletons';
import RecordSettlementDialog, {
  type Member,
  type NewSettlement,
} from '@/components/features/record-settlement-dialog';
import {
  useSettlements,
  useCreateSettlement,
  useConfirmSettlement,
  useDeleteSettlement,
  settlementKeys,
  type PaymentMethod,
} from '@/lib/hooks/use-settlements';
import { useEventDetail } from '@/lib/hooks/use-events';
import { useMe } from '@/lib/hooks/use-user';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

const METHOD_LABELS: Record<string, string> = {
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CASH: 'Tiền mặt',
  OTHER: 'Khác',
};

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

export default function SettlementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: settlements, isLoading, isError } = useSettlements(id);
  const createSettlement = useCreateSettlement(id);
  const confirmSettlement = useConfirmSettlement(id);
  const deleteSettlement = useDeleteSettlement(id);
  const { data: event } = useEventDetail(id);
  const { data: me } = useMe();

  const eventMembers = event?.members ?? [];
  const members: Member[] = eventMembers.map((m) => ({ id: m.id, name: m.nickname }));

  const myMember = eventMembers.find((m) => m.userId === me?.id);
  const isOrganizer = myMember?.role === 'ORGANIZER';

  // Track which settlement is being actioned to show per-row loading state
  const confirmingId = confirmSettlement.isPending ? confirmSettlement.variables : null;
  const deletingId = deleteSettlement.isPending ? deleteSettlement.variables : null;

  async function handleAdd(s: NewSettlement) {
    const fromMember = eventMembers.find((m) => m.id === s.fromMemberId);
    const toMember = eventMembers.find((m) => m.id === s.toMemberId);
    try {
      await createSettlement.mutateAsync({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amount: s.amount,
        method: s.method as PaymentMethod,
        _fromMember: fromMember
          ? { id: fromMember.id, nickname: fromMember.nickname, userId: fromMember.userId }
          : undefined,
        _toMember: toMember
          ? { id: toMember.id, nickname: toMember.nickname, userId: toMember.userId }
          : undefined,
      });
      toast.success('Đã ghi nhận thanh toán');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Không thể ghi nhận thanh toán. Vui lòng thử lại.';
      toast.error(msg);
      throw err;
    }
  }

  async function handleConfirm(settlementId: string) {
    try {
      await confirmSettlement.mutateAsync(settlementId);
      toast.success('Đã xác nhận thanh toán');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Không thể xác nhận thanh toán. Vui lòng thử lại.';
      toast.error(msg);
    }
  }

  async function handleReject(settlementId: string) {
    try {
      await deleteSettlement.mutateAsync(settlementId);
      toast.success('Đã từ chối thanh toán');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Không thể từ chối thanh toán. Vui lòng thử lại.';
      toast.error(msg);
    }
  }

  if (isLoading) {
    return <SettlementListSkeleton rows={3} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Không thể tải danh sách thanh toán.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void qc.invalidateQueries({ queryKey: settlementKeys.list(id) })}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  const list = settlements ?? [];
  const confirmed = list.filter((s) => s.status === 'CONFIRMED').length;
  const isBusy = confirmSettlement.isPending || deleteSettlement.isPending;

  return (
    <>
      {list.length === 0 ? (
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
              {list.length} giao dịch · {confirmed} đã xác nhận
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ghi nhận thanh toán
            </Button>
          </div>

          <div className="divide-y rounded-lg border">
            {list.map((s) => {
              const isRecipient = s.toMember.userId === me?.id;
              const canAct = s.status === 'PENDING' && (isRecipient || isOrganizer);
              const isConfirming = confirmingId === s.id;
              const isDeleting = deletingId === s.id;

              return (
                <div key={s.id} className="px-4 py-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {s.fromMember.nickname} → {s.toMember.nickname}
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {METHOD_LABELS[s.method] ?? s.method}
                        {s.proofUrl && ' · Có ảnh chứng minh'}
                        {' · '}
                        {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <span className="font-semibold text-sm shrink-0 tabular-nums">
                      {formatVND(s.amount)}
                    </span>
                  </div>

                  {canAct && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isBusy}
                        onClick={() => void handleConfirm(s.id)}
                      >
                        {isConfirming ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Xác nhận
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleReject(s.id)}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Từ chối
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RecordSettlementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        onAdd={handleAdd}
        isSubmitting={createSettlement.isPending}
      />
    </>
  );
}
