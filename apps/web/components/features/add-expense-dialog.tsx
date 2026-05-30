'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useCloudinaryUpload } from '@/lib/hooks/use-upload';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

export interface ExpenseDialogMember {
  id: string;
  name: string;
}

export interface ExpenseFormValues {
  description: string;
  amount: number;
  /** EventMember.id of the payer */
  paidById: string;
  category: ExpenseCategory;
  splitType: 'EQUAL' | 'CUSTOM';
  /** For EQUAL: member IDs to include in the split */
  memberIds?: string[];
  /** For CUSTOM: per-member amounts */
  splits?: { memberId: string; amount: number }[];
  /** null means "clear the existing receipt" (edit mode only) */
  receiptUrl?: string | null;
}

/** Shape used to pre-fill the dialog when editing an existing expense */
export interface InitialExpense {
  description: string;
  amount: number;
  paidById: string;
  category: ExpenseCategory;
  splitType: 'EQUAL' | 'CUSTOM';
  /** For EQUAL: member IDs from existing splits */
  splitMemberIds?: string[];
  /** For CUSTOM: per-member amounts from existing splits */
  customSplits?: { memberId: string; amount: number }[];
  receiptUrl?: string | null;
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ExpenseDialogMember[];
  /** Called with the API-ready payload when the form is submitted */
  onSubmit: (values: ExpenseFormValues) => void | Promise<void>;
  /** Show spinner on the submit button (e.g. while mutation is in flight) */
  isSubmitting?: boolean;
  /** Pre-fill data for edit mode */
  initialExpense?: InitialExpense;
}

// ── Keep old Member / NewExpense types as aliases for backward compat ──────────
/** @deprecated Use ExpenseDialogMember */
export type Member = ExpenseDialogMember;
/** @deprecated Use ExpenseFormValues */
export type NewExpense = ExpenseFormValues;

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'FOOD', label: 'Ăn uống' },
  { value: 'TRANSPORT', label: 'Di chuyển' },
  { value: 'ACCOMMODATION', label: 'Lưu trú' },
  { value: 'ACTIVITY', label: 'Vui chơi' },
  { value: 'OTHER', label: 'Khác' },
];

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

function getInitialCustomAmounts(members: ExpenseDialogMember[]) {
  return Object.fromEntries(members.map((m) => [m.id, '']));
}

export default function AddExpenseDialog({
  open,
  onOpenChange,
  members,
  onSubmit,
  isSubmitting = false,
  initialExpense,
}: AddExpenseDialogProps) {
  const isEditMode = initialExpense !== undefined;

  // ── form state ──────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('FOOD');
  const [payerId, setPayerId] = useState<string>(members[0]?.id ?? '');
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    getInitialCustomAmounts(members),
  );

  // ── receipt state ────────────────────────────────────────────────────────────
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  // ── submit error state (inline message shown inside dialog on failure) ───────
  const [submitError, setSubmitError] = useState('');
  // ── tracks whether the user has attempted to submit at least once ─────────────
  const [formTouched, setFormTouched] = useState(false);
  /** URL after a successful Cloudinary upload */
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  /** True when user explicitly clicked "Xoá ảnh" for an existing receipt in edit mode */
  const [receiptExplicitlyRemoved, setReceiptExplicitlyRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudinaryUpload = useCloudinaryUpload();

  // ── populate form from initialExpense when dialog opens ─────────────────────
  useEffect(() => {
    if (!open) return;
    if (initialExpense) {
      setDescription(initialExpense.description);
      setAmountRaw(String(initialExpense.amount));
      setCategory(initialExpense.category);
      setPayerId(initialExpense.paidById);
      setSplitMode(initialExpense.splitType);
      if (initialExpense.splitType === 'EQUAL') {
        const ids = initialExpense.splitMemberIds ?? members.map((m) => m.id);
        setSelectedMembers(new Set(ids));
      } else {
        const custom = Object.fromEntries(
          (initialExpense.customSplits ?? []).map((s) => [s.memberId, String(s.amount)]),
        );
        setCustomAmounts({ ...getInitialCustomAmounts(members), ...custom });
      }
      setUploadedReceiptUrl(initialExpense.receiptUrl ?? null);
      setReceipt(null);
      setReceiptError('');
      setSubmitError('');
      setReceiptExplicitlyRemoved(false);
    } else {
      // add mode — reset to defaults
      setDescription('');
      setAmountRaw('');
      setCategory('FOOD');
      setPayerId(members[0]?.id ?? '');
      setSplitMode('EQUAL');
      setSelectedMembers(new Set(members.map((m) => m.id)));
      setCustomAmounts(getInitialCustomAmounts(members));
      setUploadedReceiptUrl(null);
      setReceipt(null);
      setReceiptError('');
      setSubmitError('');
      setReceiptExplicitlyRemoved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── derived values ───────────────────────────────────────────────────────────
  const amount = parseInt(amountRaw, 10) || 0;
  const equalCount = selectedMembers.size;
  const perPerson = amount > 0 && equalCount > 0 ? Math.floor(amount / equalCount) : 0;
  const remainder = amount > 0 && equalCount > 0 ? amount - perPerson * equalCount : 0;
  const firstSelectedId = members.find((m) => selectedMembers.has(m.id))?.id;

  const customTotal = members.reduce(
    (sum, m) => sum + (parseInt(customAmounts[m.id] ?? '0', 10) || 0),
    0,
  );
  const customMismatch = amount > 0 && customTotal !== amount;

  const isValid =
    description.trim().length > 0 &&
    amount > 0 &&
    payerId !== '' &&
    !isUploading &&
    !isSubmitting &&
    (splitMode === 'EQUAL' ? equalCount > 0 : !customMismatch);

  // Per-field error messages — only shown after the user attempts to submit
  const descError = formTouched && description.trim().length === 0
    ? 'Vui lòng nhập mô tả chi phí'
    : '';
  const amountError = formTouched && amount <= 0
    ? 'Số tiền phải lớn hơn 0'
    : '';
  const equalError = formTouched && splitMode === 'EQUAL' && equalCount === 0
    ? 'Chọn ít nhất một thành viên'
    : '';
  const splitSumError = formTouched && splitMode === 'CUSTOM' && customMismatch
    ? 'Tổng chia chưa khớp với số tiền chi phí'
    : '';

  // ── handlers ─────────────────────────────────────────────────────────────────
  function resetForm() {
    setDescription('');
    setAmountRaw('');
    setCategory('FOOD');
    setPayerId(members[0]?.id ?? '');
    setSplitMode('EQUAL');
    setSelectedMembers(new Set(members.map((m) => m.id)));
    setCustomAmounts(getInitialCustomAmounts(members));
    setReceipt(null);
    setReceiptError('');
    setUploadedReceiptUrl(null);
    setIsUploading(false);
    setSubmitError('');
    setReceiptExplicitlyRemoved(false);
    setFormTouched(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(value: boolean) {
    if (!value && !isSubmitting && !isUploading) resetForm();
    onOpenChange(value);
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptError('Chỉ chấp nhận ảnh JPG, PNG, HEIC hoặc HEIF.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptError('Ảnh không được vượt quá 5 MB.');
      e.target.value = '';
      return;
    }
    setReceiptError('');
    setReceipt(file);
    setUploadedReceiptUrl(null);
    setReceiptExplicitlyRemoved(false);

    // Upload immediately on selection
    setIsUploading(true);
    try {
      const url = await cloudinaryUpload.mutateAsync(file);
      setUploadedReceiptUrl(url);
    } catch (err) {
      // AbortError means a newer file selection cancelled this upload intentionally.
      // Do NOT clear the receipt state — the newer file's handleReceiptChange has
      // already set its own state and should not be overwritten.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setReceiptError('Tải ảnh thất bại — ảnh hoá đơn sẽ không được lưu.');
      setReceipt(null);
      setUploadedReceiptUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  }

  function removeReceipt() {
    setReceipt(null);
    setReceiptError('');
    setUploadedReceiptUrl(null);
    if (isEditMode) setReceiptExplicitlyRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    setFormTouched(true);
    if (!isValid) return;

    const receiptPayload: { receiptUrl?: string | null } = uploadedReceiptUrl
      ? { receiptUrl: uploadedReceiptUrl }
      : isEditMode && receiptExplicitlyRemoved
        ? { receiptUrl: null }
        : {};

    const values: ExpenseFormValues = {
      description: description.trim(),
      amount,
      paidById: payerId,
      category,
      splitType: splitMode,
      ...receiptPayload,
    };

    if (splitMode === 'EQUAL') {
      values.memberIds = [...selectedMembers];
    } else {
      values.splits = members
        .map((m) => ({
          memberId: m.id,
          amount: parseInt(customAmounts[m.id] ?? '0', 10) || 0,
        }))
        .filter((s) => s.amount > 0);
    }

    setSubmitError('');
    try {
      await onSubmit(values);
      handleOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Không thể lưu chi phí. Vui lòng thử lại.',
      );
    }
  }

  const busy = isSubmitting || isUploading;
  const dialogTitle = isEditMode ? 'Chỉnh sửa chi phí' : 'Thêm chi phí';
  const submitLabel = isEditMode ? 'Lưu thay đổi' : 'Thêm chi phí';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">
              Mô tả{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="exp-desc"
              placeholder="VD: Bữa tối, Khách sạn…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {descError && <p className="text-xs text-destructive">{descError}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">
              Số tiền (₫){' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="exp-amount"
              inputMode="numeric"
              placeholder="0"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value.replace(/\D/g, ''))}
            />
            {amountError ? (
              <p className="text-xs text-destructive">{amountError}</p>
            ) : amount > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {amount.toLocaleString('vi-VN')} ₫
              </p>
            ) : null}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Danh mục</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    category === value
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Payer */}
          <div className="space-y-1.5">
            <Label>Người trả</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayerId(m.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    payerId === m.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Split mode */}
          <div className="space-y-1.5">
            <Label>Cách chia</Label>
            <Tabs
              value={splitMode}
              onValueChange={(v) => setSplitMode(v as 'EQUAL' | 'CUSTOM')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="EQUAL" className="flex-1">
                  Chia đều
                </TabsTrigger>
                <TabsTrigger value="CUSTOM" className="flex-1">
                  Tùy chỉnh
                </TabsTrigger>
              </TabsList>

              {/* Equal split */}
              <TabsContent value="EQUAL">
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const checked = selectedMembers.has(m.id);
                    const isFirst = m.id === firstSelectedId;
                    const share =
                      checked && perPerson > 0
                        ? perPerson + (isFirst ? remainder : 0)
                        : null;
                    return (
                      <label
                        key={m.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-foreground"
                            checked={checked}
                            onChange={() => toggleMember(m.id)}
                          />
                          <span className="text-sm">{m.name}</span>
                        </div>
                        {share !== null ? (
                          <span className="text-sm font-medium tabular-nums text-muted-foreground">
                            {share.toLocaleString('vi-VN')} ₫
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </label>
                    );
                  })}
                  {equalError && (
                    <p className="text-xs text-destructive">{equalError}</p>
                  )}
                </div>
              </TabsContent>

              {/* Custom split */}
              <TabsContent value="CUSTOM">
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{m.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          className="w-28 h-8 text-sm tabular-nums"
                          inputMode="numeric"
                          placeholder="0"
                          value={customAmounts[m.id] ?? ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setCustomAmounts((prev) => ({ ...prev, [m.id]: digits }));
                          }}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">₫</span>
                      </div>
                    </div>
                  ))}

                  <div
                    className={cn(
                      'flex items-center justify-between text-sm font-medium pt-2 border-t',
                      customMismatch ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    <span>Tổng đã chia</span>
                    <span className="tabular-nums">
                      {customTotal.toLocaleString('vi-VN')} ₫
                      {amount > 0 && (
                        <span className="text-xs font-normal ml-1 text-muted-foreground">
                          / {amount.toLocaleString('vi-VN')} ₫
                        </span>
                      )}
                    </span>
                  </div>
                  {(customMismatch || splitSumError) && (
                    <p className="text-xs text-destructive">
                      {splitSumError || 'Tổng chia chưa khớp với số tiền chi phí.'}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Receipt upload */}
          <div className="space-y-1.5">
            <Label>Ảnh hoá đơn (tuỳ chọn)</Label>
            {receipt ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{receipt.name}</span>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <>
                    {uploadedReceiptUrl && (
                      <span className="text-xs text-green-600 shrink-0">✓</span>
                    )}
                    <button
                      type="button"
                      onClick={removeReceipt}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Xoá ảnh"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ) : uploadedReceiptUrl && isEditMode ? (
              // Edit mode: show existing receipt URL
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={uploadedReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary truncate flex-1 hover:underline"
                >
                  Xem ảnh hiện tại
                </a>
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Xoá ảnh"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Chọn ảnh JPG, PNG hoặc HEIC — tối đa 5 MB
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif"
                  className="sr-only"
                  onChange={handleReceiptChange}
                />
              </label>
            )}
            {receiptError && <p className="text-xs text-destructive">{receiptError}</p>}
          </div>
        </div>

        {submitError && (
          <p className="text-xs text-destructive" role="alert">
            {submitError}
          </p>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isUploading ? 'Đang tải ảnh…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
