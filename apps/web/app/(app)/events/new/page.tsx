'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EventType = 'TRIP' | 'MEAL' | 'OTHER';

const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 MB

const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: 'TRIP', label: 'Chuyến đi', emoji: '✈️' },
  { value: 'MEAL', label: 'Bữa ăn', emoji: '🍜' },
  { value: 'OTHER', label: 'Khác', emoji: '📌' },
];

export default function NewEventPage() {
  const [name, setName] = useState('');
  const [type, setType] = useState<EventType>('TRIP');
  const [description, setDescription] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke object URL on unmount to avoid memory leak
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_COVER_SIZE) {
      setCoverError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setCoverError(null);
    // Revoke previous URL before creating a new one
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setCoverPreview(url);
  }

  function removeCover() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setCoverPreview(null);
    setCoverError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // API call wired in Phase 4
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tạo chuyến đi mới</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Điền thông tin cơ bản. Bạn có thể chỉnh sửa sau.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin sự kiện</CardTitle>
          <CardDescription>Tên và loại sự kiện là bắt buộc.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Tên sự kiện <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="VD: Đà Lạt tháng 6, Tất niên 2026…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>
                Loại sự kiện <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1 rounded-lg border py-3 text-sm font-medium transition-colors',
                      type === t.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                    )}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="Thêm ghi chú hoặc lịch trình ngắn gọn…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
              />
            </div>

            {/* Cover photo */}
            <div className="space-y-1.5">
              <Label>Ảnh bìa (tuỳ chọn)</Label>
              {coverPreview ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="Ảnh bìa xem trước"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeCover}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Xoá ảnh"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-sm">Chọn ảnh (JPG, PNG, tối đa 5 MB)</span>
                </button>
              )}
              {coverError && (
                <p className="text-sm text-destructive">{coverError}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={!name.trim()} className="flex-1">
                Tạo sự kiện
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Huỷ</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
