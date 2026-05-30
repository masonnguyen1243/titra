'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ImagePlus, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useCreateEvent } from '@/lib/hooks/use-events';
import { ApiError } from '@/lib/api';

type EventType = 'TRIP' | 'MEAL' | 'OTHER';

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png'];

const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: 'TRIP', label: 'Chuyến đi', emoji: '✈️' },
  { value: 'MEAL', label: 'Bữa ăn', emoji: '🍜' },
  { value: 'OTHER', label: 'Khác', emoji: '📌' },
];

const createEventSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sự kiện'),
  type: z.enum(['TRIP', 'MEAL', 'OTHER'], {
    required_error: 'Vui lòng chọn loại sự kiện',
  }),
  description: z.string().optional(),
});

type CreateEventFormValues = z.infer<typeof createEventSchema>;

export default function NewEventPage() {
  const router = useRouter();
  const { mutate: createEvent, isPending } = useCreateEvent();

  // Cover photo state lives outside RHF — it's not part of the validated payload yet
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { name: '', type: 'TRIP', description: '' },
  });

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setCoverError('Chỉ chấp nhận ảnh JPG hoặc PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_COVER_SIZE) {
      setCoverError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setCoverError(null);
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

  function onSubmit(values: CreateEventFormValues) {
    createEvent(
      {
        name: values.name.trim(),
        type: values.type,
        description: values.description?.trim() || undefined,
        // coverImageUrl will be wired once Cloudinary upload is implemented
      },
      {
        onSuccess: (newEvent) => {
          toast.success('Sự kiện đã được tạo!');
          router.push(`/events/${newEvent.id}`);
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : 'Không thể tạo sự kiện. Vui lòng thử lại.';
          toast.error(message);
        },
      },
    );
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tên sự kiện <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="VD: Đà Lạt tháng 6, Tất niên 2026…"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Loại sự kiện <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {EVENT_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => field.onChange(t.value)}
                            className={cn(
                              'flex-1 flex flex-col items-center gap-1 rounded-lg border py-3 text-sm font-medium transition-colors',
                              field.value === t.value
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                            )}
                          >
                            <span className="text-xl">{t.emoji}</span>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả (tuỳ chọn)</FormLabel>
                    <FormControl>
                      <textarea
                        rows={3}
                        placeholder="Thêm ghi chú hoặc lịch trình ngắn gọn…"
                        disabled={isPending}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cover photo (outside RHF — not yet uploaded to Cloudinary) */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-none">Ảnh bìa (tuỳ chọn)</p>
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
                {coverError && <p className="text-sm text-destructive">{coverError}</p>}
                {coverPreview && !coverError && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Ảnh bìa sẽ chưa được tải lên — tính năng này đang được phát triển. Sự kiện sẽ
                      vẫn được tạo bình thường.
                    </span>
                  </div>
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
                <Button type="submit" disabled={isPending} className="flex-1">
                  {isPending ? 'Đang tạo…' : 'Tạo sự kiện'}
                </Button>
                <Button variant="outline" asChild disabled={isPending}>
                  <Link href="/dashboard">Huỷ</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
