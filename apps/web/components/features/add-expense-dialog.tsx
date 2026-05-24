'use client';

import { useRef, useState } from 'react';
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
import { Paperclip, X } from 'lucide-react';

type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'ACCOMMODATION' | 'ACTIVITY' | 'OTHER';

export interface Member {
  id: string;
  name: string;
}

export interface NewExpense {
  description: string;
  amount: number;
  category: ExpenseCategory;
  payer: string;
  date: string;
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  onAdd: (expense: NewExpense) => void;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'FOOD', label: 'Ăn uống' },
  { value: 'TRANSPORT', label: 'Di chuyển' },
  { value: 'ACCOMMODATION', label: 'Lưu trú' },
  { value: 'ACTIVITY', label: 'Vui chơi' },
  { value: 'OTHER', label: 'Khác' },
];

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

function getInitialCustomAmounts(members: Member[]) {
  return Object.fromEntries(members.map((m) => [m.id, '']));
}

export default function AddExpenseDialog({
  open,
  onOpenChange,
  members,
  onAdd,
}: AddExpenseDialogProps) {
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
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    (splitMode === 'EQUAL' ? equalCount > 0 : !customMismatch);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetForm();
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

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptError('Ảnh không được vượt quá 5 MB.');
      e.target.value = '';
      return;
    }
    setReceiptError('');
    setReceipt(file);
  }

  function removeReceipt() {
    setReceipt(null);
    setReceiptError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit() {
    if (!isValid) return;
    const payerName = members.find((m) => m.id === payerId)?.name ?? payerId;
    onAdd({
      description: description.trim(),
      amount,
      category,
      payer: payerName,
      date: new Date().toISOString().slice(0, 10),
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm chi phí</DialogTitle>
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
            {amount > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {amount.toLocaleString('vi-VN')} ₫
              </p>
            )}
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
                  {equalCount === 0 && (
                    <p className="text-xs text-destructive">Chọn ít nhất một thành viên.</p>
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
                  {customMismatch && (
                    <p className="text-xs text-destructive">
                      Tổng chia chưa khớp với số tiền chi phí.
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
                  accept="image/jpeg,image/png,image/heic"
                  className="sr-only"
                  onChange={handleReceiptChange}
                />
              </label>
            )}
            {receiptError && <p className="text-xs text-destructive">{receiptError}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Thêm chi phí
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
