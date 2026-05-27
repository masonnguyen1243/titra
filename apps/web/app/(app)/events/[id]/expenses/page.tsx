'use client';

import { use, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Receipt, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ExpenseListSkeleton } from '@/components/ui/skeletons';
import AddExpenseDialog, {
  type ExpenseDialogMember,
  type ExpenseFormValues,
  type InitialExpense,
} from '@/components/features/add-expense-dialog';
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  expenseKeys,
  type Expense,
} from '@/lib/hooks/use-expenses';
import { useEventDetail } from '@/lib/hooks/use-events';
import { useMe } from '@/lib/hooks/use-user';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Ăn uống',
  TRANSPORT: 'Di chuyển',
  ACCOMMODATION: 'Lưu trú',
  ACTIVITY: 'Vui chơi',
  OTHER: 'Khác',
};

const CATEGORY_VARIANTS: Record<
  string,
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

/** Map an API Expense to the initial values format for the dialog */
function toInitialExpense(expense: Expense): InitialExpense {
  const category = (expense.category ?? 'OTHER') as ExpenseCategory;
  if (expense.splitType === 'CUSTOM') {
    return {
      description: expense.description,
      amount: expense.amount,
      paidById: expense.paidBy.id,
      category,
      splitType: 'CUSTOM',
      customSplits: expense.splits.map((s) => ({
        memberId: s.memberId,
        amount: s.amount,
      })),
      receiptUrl: expense.receiptUrl,
    };
  }
  return {
    description: expense.description,
    amount: expense.amount,
    paidById: expense.paidBy.id,
    category,
    splitType: 'EQUAL',
    splitMemberIds: expense.splits.map((s) => s.memberId),
    receiptUrl: expense.receiptUrl,
  };
}

export default function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // ── server data ────────────────────────────────────────────────────────────
  const qc = useQueryClient();
  const { data: expenses, isLoading, isError } = useExpenses(id);
  const { data: event } = useEventDetail(id);
  const { data: me } = useMe();

  // ── mutations ──────────────────────────────────────────────────────────────
  const createExpense = useCreateExpense(id, event?.members);
  const updateExpense = useUpdateExpense(id);
  const deleteExpense = useDeleteExpense(id);

  // ── dialog state ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  /** expenseId waiting for delete confirmation */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── derived values ─────────────────────────────────────────────────────────
  const members: ExpenseDialogMember[] = (event?.members ?? []).map((m) => ({
    id: m.id,
    name: m.nickname,
  }));

  /** True when the current user is the event organizer */
  const isOrganizer =
    event?.members.find((m) => m.userId === me?.id)?.role === 'ORGANIZER';

  // ── handlers ───────────────────────────────────────────────────────────────
  async function handleSubmit(values: ExpenseFormValues) {
    try {
      if (editingExpense) {
        await updateExpense.mutateAsync({
          expenseId: editingExpense.id,
          payload: values,
        });
        toast.success('Chi phí đã được cập nhật');
      } else {
        await createExpense.mutateAsync(values);
        toast.success('Chi phí đã được thêm');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể lưu chi phí. Vui lòng thử lại.';
      toast.error(msg);
      // Re-throw so AddExpenseDialog keeps itself open on failure
      throw err;
    }
  }

  function openAdd() {
    setEditingExpense(null);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setDialogOpen(true);
  }

  async function handleDelete(expenseId: string) {
    setConfirmDeleteId(null);
    try {
      await deleteExpense.mutateAsync(expenseId);
      toast.success('Chi phí đã được xoá');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể xoá chi phí. Vui lòng thử lại.';
      toast.error(msg);
    }
  }

  // ── render: loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return <ExpenseListSkeleton rows={4} />;
  }

  // ── render: error ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <EmptyState
        icon={Receipt}
        title="Không thể tải chi phí"
        description="Đã xảy ra lỗi khi tải danh sách chi phí. Vui lòng thử lại."
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => void qc.invalidateQueries({ queryKey: expenseKeys.list(id) })}
        >
          Thử lại
        </Button>
      </EmptyState>
    );
  }

  const expenseList = expenses ?? [];
  const totalAmount = expenseList.reduce((sum, e) => sum + e.amount, 0);

  const isBusy =
    createExpense.isPending || updateExpense.isPending || deleteExpense.isPending;

  return (
    <>
      {expenseList.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có chi phí nào"
          description="Hãy thêm chi phí đầu tiên cho sự kiện này."
        >
          <Button size="sm" onClick={openAdd} disabled={isBusy}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm chi phí
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {expenseList.length} khoản · Tổng{' '}
              <span className="font-semibold text-foreground">{formatVND(totalAmount)}</span>
            </p>
            <Button size="sm" onClick={openAdd} disabled={isBusy}>
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm chi phí
            </Button>
          </div>

          <div className="divide-y rounded-lg border">
            {expenseList.map((expense) => {
              const isConfirmingDelete = confirmDeleteId === expense.id;
              const categoryLabel = CATEGORY_LABELS[expense.category ?? 'OTHER'] ?? 'Khác';
              const categoryVariant = CATEGORY_VARIANTS[expense.category ?? 'OTHER'] ?? 'outline';
              /** Only the payer (expense creator) or the organizer may edit/delete */
              const canManage = isOrganizer || expense.paidBy.userId === me?.id;

              return (
                <div
                  key={expense.id}
                  className="group flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{expense.description}</span>
                      <Badge variant={categoryVariant} className="text-xs shrink-0">
                        {categoryLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {expense.paidBy.nickname} ·{' '}
                      {new Date(expense.createdAt).toLocaleDateString('vi-VN')}
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 ml-2 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Hoá đơn
                        </a>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-sm tabular-nums">
                      {formatVND(expense.amount)}
                    </span>

                    {canManage && (
                      isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleDelete(expense.id)}
                            disabled={deleteExpense.isPending}
                          >
                            Xoá
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Huỷ
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label="Chỉnh sửa"
                            disabled={isBusy}
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            aria-label="Xoá"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteId(expense.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddExpenseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingExpense(null);
        }}
        members={members}
        onSubmit={handleSubmit}
        isSubmitting={createExpense.isPending || updateExpense.isPending}
        initialExpense={editingExpense ? toInitialExpense(editingExpense) : undefined}
      />
    </>
  );
}
