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
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2, Paperclip, X } from 'lucide-react';
import { useCloudinaryUpload } from '@/lib/hooks/use-upload';

function buildDeepLink(method: 'MOMO' | 'VNPAY', amount: number, phone: string, account: string) {
  const note = encodeURIComponent('Thanh toán qua Titra');
  if (method === 'MOMO') {
    if (phone) {
      const p = encodeURIComponent(phone);
      return `momo://transfer?phone=${p}&amount=${amount}&note=${note}`;
    }
    return `momo://transfer?amount=${amount}&note=${note}`;
  }
  if (account) {
    const a = encodeURIComponent(account);
    return `vnpay://transfer?account=${a}&amount=${amount}&desc=${note}`;
  }
  return `vnpay://transfer?amount=${amount}&desc=${note}`;
}

type PaymentMethod = 'MOMO' | 'VNPAY' | 'CASH' | 'OTHER';

export interface Member {
  id: string;
  name: string;
}

export interface NewSettlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  method: PaymentMethod;
  proofUrl?: string | null;
}

interface RecordSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  onAdd: (settlement: NewSettlement) => void | Promise<void>;
  isSubmitting?: boolean;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'MOMO', label: 'MoMo' },
  { value: 'VNPAY', label: 'VNPay' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'OTHER', label: 'Khác' },
];

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export default function RecordSettlementDialog({
  open,
  onOpenChange,
  members,
  onAdd,
  isSubmitting = false,
}: RecordSettlementDialogProps) {
  const [fromId, setFromId] = useState<string>(members[0]?.id ?? '');
  const [toId, setToId] = useState<string>(members[1]?.id ?? members[0]?.id ?? '');
  const [amountRaw, setAmountRaw] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('MOMO');
  const [momoPhone, setMomoPhone] = useState('');
  const [vnpayAccount, setVnpayAccount] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState('');
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudinaryUpload = useCloudinaryUpload();

  const amount = parseInt(amountRaw, 10) || 0;
  const samePersonError = fromId !== '' && fromId === toId;
  const isValid = fromId !== '' && toId !== '' && !samePersonError && amount > 0 && method !== null;

  const amountError = formTouched && amount <= 0 ? 'Số tiền phải lớn hơn 0' : '';
  const methodError = formTouched && !method ? 'Vui lòng chọn hình thức thanh toán' : '';

  function resetForm() {
    setFromId(members[0]?.id ?? '');
    setToId(members[1]?.id ?? members[0]?.id ?? '');
    setAmountRaw('');
    setMethod('MOMO');
    setMomoPhone('');
    setVnpayAccount('');
    setProof(null);
    setProofError('');
    setUploadedProofUrl(null);
    setIsUploading(false);
    setFormTouched(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetForm();
    onOpenChange(value);
  }

  async function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      setProofError('Chỉ chấp nhận ảnh JPG, PNG hoặc HEIC.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PROOF_SIZE) {
      setProofError('Ảnh không được vượt quá 5 MB.');
      e.target.value = '';
      return;
    }
    setProofError('');
    setProof(file);
    setUploadedProofUrl(null);

    setIsUploading(true);
    try {
      const url = await cloudinaryUpload.mutateAsync(file);
      setUploadedProofUrl(url);
    } catch (err) {
      // AbortError means a newer file selection cancelled this upload — don't clear state.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setProofError('Tải ảnh thất bại — ảnh chứng minh sẽ không được lưu.');
      setProof(null);
      setUploadedProofUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  }

  function removeProof() {
    setProof(null);
    setProofError('');
    setUploadedProofUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    setFormTouched(true);
    if (!isValid) return;
    try {
      await onAdd({
        fromMemberId: fromId,
        toMemberId: toId,
        amount,
        method,
        proofUrl: uploadedProofUrl ?? undefined,
      });
      handleOpenChange(false);
    } catch {
      // caller (page) is responsible for showing the error toast; keep dialog open
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* From (payer) */}
          <div className="space-y-1.5">
            <Label>
              Người trả{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFromId(m.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    fromId === m.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* To (recipient) */}
          <div className="space-y-1.5">
            <Label>
              Trả cho{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setToId(m.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    toId === m.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {samePersonError && (
              <p className="text-xs text-destructive">Người trả và người nhận không được giống nhau.</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="stl-amount">
              Số tiền (₫){' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="stl-amount"
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

          {/* Payment method */}
          <div className="space-y-1.5">
            <Label>
              Hình thức thanh toán{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    method === value
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {methodError && <p className="text-xs text-destructive">{methodError}</p>}
          </div>

          {/* MoMo / VNPay deep-link */}
          {(method === 'MOMO' || method === 'VNPAY') && (
            <div className="space-y-2">
              {method === 'MOMO' && (
                <div className="space-y-1.5">
                  <Label htmlFor="stl-momo-phone">
                    Số điện thoại MoMo của người nhận{' '}
                    <span className="text-muted-foreground font-normal">(tuỳ chọn)</span>
                  </Label>
                  <Input
                    id="stl-momo-phone"
                    inputMode="tel"
                    placeholder="0912 345 678"
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}
              {method === 'VNPAY' && (
                <div className="space-y-1.5">
                  <Label htmlFor="stl-vnpay-account">
                    Số tài khoản VNPay của người nhận{' '}
                    <span className="text-muted-foreground font-normal">(tuỳ chọn)</span>
                  </Label>
                  <Input
                    id="stl-vnpay-account"
                    placeholder="Số tài khoản"
                    value={vnpayAccount}
                    onChange={(e) => setVnpayAccount(e.target.value)}
                  />
                </div>
              )}
              {amount > 0 && (
                <a
                  href={buildDeepLink(method, amount, momoPhone, vnpayAccount)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  Mở ứng dụng {method === 'MOMO' ? 'MoMo' : 'VNPay'} —{' '}
                  {amount.toLocaleString('vi-VN')} ₫
                </a>
              )}
            </div>
          )}

          {/* Proof upload */}
          <div className="space-y-1.5">
            <Label>Ảnh chứng minh chuyển khoản (tuỳ chọn)</Label>
            {proof ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm truncate flex-1">
                  {isUploading ? 'Đang tải ảnh lên…' : proof.name}
                </span>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={removeProof}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Xoá ảnh"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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
                  onChange={(e) => void handleProofChange(e)}
                />
              </label>
            )}
            {uploadedProofUrl && !isUploading && (
              <p className="text-xs text-green-600">Ảnh đã được tải lên ✓</p>
            )}
            {proofError && <p className="text-xs text-destructive">{proofError}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting || isUploading}
          >
            Huỷ
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || isUploading}
          >
            {(isSubmitting || isUploading) && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            {isUploading ? 'Đang tải ảnh…' : 'Ghi nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
